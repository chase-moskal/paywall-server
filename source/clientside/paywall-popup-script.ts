
import {loadStripe} from "@stripe/stripe-js"
import {PaywallPopupSettings} from "./interfaces.js"
import {namespace} from "authoritarian/dist/business/paywall-popup/common.js"
import {unpackCorsConfig} from "authoritarian/dist/toolbox/unpack-cors-config.js"
import {validateRequest} from "authoritarian/dist/toolbox/popups/validate-request.js"
import {PaywallPopupParameters, PaywallPopupPayload} from "authoritarian/dist/business/paywall-popup/interfaces.js"
import {PopupFlag, PopupReadyResponse, PopupMessageEvent, PopupGoRequest, PopupPayloadResponse} from "authoritarian/dist/toolbox/popups/interfaces.js"

declare global {
	interface Window {
		settings: PaywallPopupSettings
	}
}

~async function main() {
	const {settings} = window
	const {hash} = window.location
	const success = hash.endsWith("success")
	const cancel = hash.endsWith("cancel")
	const initial = !(success || cancel)

	if (initial) {
		const cors = unpackCorsConfig(settings.cors)

		// RECEIVE POSTMESSAGE GoRequest
		// - plan
		// - userId
		window.addEventListener("message", async function goListener(
			event: PopupMessageEvent<PopupGoRequest<PaywallPopupParameters>>
		) {

			// don't continue unless the request is validated
			if (!validateRequest({namespace, event, cors}))
				return null

			// stop listening (only listen once, it's a one-off)
			window.removeEventListener("message", goListener)

			// extract parameters out of the go request
			const {parameters} = event.data
			const {
				stripePlanId: plan,
				userId: clientReferenceId,
			} = parameters
			// const plan = "plan_H5oUIjw9895qDj"
	
			// construct callback url's for stripe (this page but with querystring)
			const {protocol, host, pathname} = window.location
			const baseUrl = `${protocol}//${host}${pathname}`
			const cancelUrl = `${baseUrl}#cancel`
			const successUrl = `${baseUrl}#success`
	
			// initiate the stripe redirection flow
			const stripe = await loadStripe(settings.stripeApiKey)
			stripe.redirectToCheckout({
				cancelUrl,
				successUrl,
				clientReferenceId,
				items: [{plan, quantity: 1}],
			})
		})
	}
	else {
		const active = success
		document.body.innerHTML = success ? "SUCCESS" : "CANCEL"

		//
		// RECEIVE POSTMESSAGE GoRequest
		//
		window.addEventListener("message", async function goListener(
			event: PopupMessageEvent<PopupGoRequest<PaywallPopupParameters>>
		) {

			// SEND POSTMESSAGE PayloadResponse
			// - active: boolean
			opener.postMessage(<PopupPayloadResponse<PaywallPopupPayload>>{
				namespace,
				payload: {active},
				flag: PopupFlag.PayloadResponse,
			}, event.origin)
		})
	}

	// SEND POSTMESSAGE BROADCAST ReadyResponse
	opener.postMessage(<PopupReadyResponse>{
		namespace,
		flag: PopupFlag.ReadyResponse
	}, "*")
}().catch(error => console.error(error))
