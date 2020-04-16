
import {PaywallPopupSettings} from "./interfaces.js"
import {PaywallPopupState} from "authoritarian/dist/interfaces.js"
import {unpackCorsConfig} from "authoritarian/dist/toolbox/unpack-cors-config.js"
import {setupPaywallPopup} from "authoritarian/dist/business/paywall-popup/setup-paywall-popup.js"

declare global {
	interface Window {
		settings: PaywallPopupSettings
	}
}

~async function main() {
	const {settings} = window
	const cors = unpackCorsConfig(settings.cors)
	const {stripeApiKey} = settings

	const {hash} = window.location
	const success = hash.endsWith("success")
	const cancel = hash.endsWith("cancel")
	const initial = !(success || cancel)
	const state: PaywallPopupState = initial
		? PaywallPopupState.Initial
		: PaywallPopupState.Done

	setupPaywallPopup({
		cors,
		state,
		stripeApiKey,
	})

}().catch(error => console.error(error))
