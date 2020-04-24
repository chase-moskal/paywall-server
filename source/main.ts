
import Koa from "./commonjs/koa.js"
import cors from "./commonjs/koa-cors.js"
import Stripe from "./commonjs/stripe.js"
import mount from "./commonjs/koa-mount.js"
import serve from "./commonjs/koa-static.js"
import bodyParser from "./commonjs/koa-bodyparser.js"

import {apiServer} from "renraku/dist/api-server.js"
import {Logger} from "authoritarian/dist/toolbox/logger.js"
import {health} from "authoritarian/dist/toolbox/health.js"
import {read, readYaml} from "authoritarian/dist/toolbox/reading.js"
import {httpHandler} from "authoritarian/dist/toolbox/http-handler.js"
import {connectMongo} from "authoritarian/dist/toolbox/connect-mongo.js"
import {curryVerifyToken} from "redcrypto/dist/curries/curry-verify-token.js"
import {PaywallServerConfig, PaywallApi} from "authoritarian/dist/interfaces.js"
import {unpackCorsConfig} from "authoritarian/dist/toolbox/unpack-cors-config.js"
import {deathWithDignity} from "authoritarian/dist/toolbox/death-with-dignity.js"
import {makeAuthVanguard} from "authoritarian/dist/business/auth-api/vanguard.js"
import {makeStripeLiaison} from "authoritarian/dist/business/paywall/stripe-liaison.js"
import {makeStripeWebhooks} from "authoritarian/dist/business/paywall/stripe-webhooks.js"
import {makePaywallOverlord} from "authoritarian/dist/business/paywall/paywall-overlord.js"
import {makeBillingDatalayer} from "authoritarian/dist/business/paywall/billing-datalayer.js"
import {mongoUserDatalayer} from "authoritarian/dist/business/auth-api/mongo-user-datalayer.js"

import {getTemplate} from "./toolbox/get-template.js"
import {PaywallPopupSettings} from "./clientside/interfaces.js"

const logger = new Logger()
deathWithDignity({logger})

const paths = {
	config: "config/config.yaml",
	templates: "source/clientside/templates",
	authServerPublicKey: "config/auth-server.public.pem",
}

~async function main() {
	const config: PaywallServerConfig = await readYaml(paths.config)
	const authServerPublicKey = await read(paths.authServerPublicKey)
	const {debug} = config
	const {
		port,
		stripeApiKey,
		stripeSecret,
		stripeWebhooksSecret,
		premiumSubscriptionStripePlanId,
	} = config.paywallServer
	const verifyToken = curryVerifyToken(authServerPublicKey)

	const templates = {
		paywallPopup: await getTemplate(
			`${paths.templates}/paywall-popup.pug`
		)
	}

	const stripe = new Stripe(stripeSecret, {apiVersion: "2020-03-02"})
	const database = await connectMongo(config.mongo)
	const userDatalayer = mongoUserDatalayer(database.collection("users"))
	const {authVanguard} = makeAuthVanguard({userDatalayer})
	const billing = makeBillingDatalayer({
		stripe,
		collection: database.collection("stripeBilling"),
	})
	const paywallOverlord = makePaywallOverlord({authVanguard})
	const stripeWebhooks = makeStripeWebhooks({
		logger,
		stripe,
		billing,
		paywallOverlord,
	})
	const stripeLiaison = makeStripeLiaison({
		stripe,
		billing,
		verifyToken,
		paywallOverlord,
		premiumSubscriptionStripePlanId,
	})

	const staticKoa = new Koa()
		.use(cors())
		.use(httpHandler("get", "/paywall-popup", async() => {
			logger.log("static /paywall-popup")
			return templates.paywallPopup({
					settings: <PaywallPopupSettings>{
					stripeApiKey,
					cors: config.cors,
				}
			})
		}))
		.use(serve("dist/clientside"))

	const nodeModulesKoa = new Koa()
		.use(cors())
		.use(serve("node_modules"))

	const stripeWebhooksKoa = new Koa()
		.use(bodyParser())
		.use(async context => {
			try {
				const {rawBody} = context.request
				const {["stripe-signature"]: signature} = context.request.headers
				const event = stripe.webhooks.constructEvent(
					rawBody,
					signature,
					stripeWebhooksSecret,
				)
				const webhook = stripeWebhooks[event.type]
				await webhook(event)
				context.status = 200
				context.body = ""
			}
			catch (error) {
				logger.error(error)
				context.status = 500
				context.body = "webhook error"
			}
		})

	const {koa: apiKoa} = await apiServer<PaywallApi>({
		debug,
		logger,
		exposures: {
			stripeLiaison: {
				exposed: stripeLiaison,
				cors: unpackCorsConfig(config.cors),
			}
		},
	})

	// compose middlewares into the final server
	new Koa()
		.use(health({logger}))
		.use(mount("/static", staticKoa))
		.use(mount("/source/clientside", new Koa()
			.use(cors())
			.use(serve("source/clientside"))
		))
		.use(mount("/node_modules", nodeModulesKoa))
		.use(mount("/api", apiKoa))
		.use(mount("/stripe/webhooks", stripeWebhooksKoa))
		.listen({host: "0.0.0.0", port})

	logger.info(`🌐 paywall-server on ${port}`)

}().catch(error => logger.error(error))
