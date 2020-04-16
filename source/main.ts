
// import {apiServer} from "renraku/dist/api-server.js"
// import {curryVerifyToken} from "redcrypto/dist/curries/curry-verify-token.js"

import Koa from "./commonjs/koa.js"
import cors from "./commonjs/koa-cors.js"
import mount from "./commonjs/koa-mount.js"
import serve from "./commonjs/koa-static.js"

import {Logger} from "authoritarian/dist/toolbox/logger.js"
import {health} from "authoritarian/dist/toolbox/health.js"
import {readYaml} from "authoritarian/dist/toolbox/reading.js"
import {PaywallServerConfig} from "authoritarian/dist/interfaces.js"
import {httpHandler} from "authoritarian/dist/toolbox/http-handler.js"
// import {connectMongo} from "authoritarian/dist/toolbox/connect-mongo.js"
import {deathWithDignity} from "authoritarian/dist/toolbox/death-with-dignity.js"
// import {unpackCorsConfig} from "authoritarian/dist/toolbox/unpack-cors-config.js"
// import {makeAuthVanguard} from "authoritarian/dist/business/auth-api/vanguard.js"
// import {mongoUserDatalayer} from "authoritarian/dist/business/auth-api/mongo-user-datalayer.js"

import {getTemplate} from "./toolbox/get-template.js"
import {PaywallPopupSettings} from "./clientside/interfaces.js"

const logger = new Logger()
deathWithDignity({logger})

const paths = {
	config: "config/config.yaml",
	authServerPublicKey: "config/auth-server.public.pem",
	templates: "source/clientside/templates"
}

~async function main() {
	const config: PaywallServerConfig = await readYaml(paths.config)
	const {port} = config.paywallServer
	const templates = {
		paywallPopup: await getTemplate(
			`${paths.templates}/paywall-popup.pug`
		)
	}

	// const database = await connectMongo(config.mongo)
	// const usersCollection = database.collection("users")
	// const paymentsCollection = database.collection("payments")
	// const authServerPublicKey = await read(paths.authServerPublicKey)

	// // generate auth-vanguard and the lesser auth-dealer
	// const userDatalayer = mongoUserDatalayer(usersCollection)
	// const {authVanguard} = makeAuthVanguard({userDatalayer})

	const staticKoa = new Koa()
		.use(cors())
		.use(httpHandler("get", "/paywall-popup", async() => {
			logger.log("static /paywall-popup")
			const settings: PaywallPopupSettings = {
				cors: config.cors,
				stripeApiKey: config.paywallServer.stripeApiKey,
			}
			return templates.paywallPopup({settings})
		}))
		.use(serve("dist/clientside"))

	const nodeModulesKoa = new Koa()
		.use(cors())
		.use(serve("node_modules"))

	new Koa()
		.use(health({logger}))
		.use(mount("/static", staticKoa))
		.use(mount("/source/clientside", new Koa()
			.use(cors())
			.use(serve("source/clientside"))
		))
		.use(mount("/node_modules", nodeModulesKoa))
		// .use(mount("/api", apiKoa))
		.listen({host: "0.0.0.0", port})

	logger.info(`🌐 paywall-server on ${port}`)

}().catch(error => logger.error(error))
