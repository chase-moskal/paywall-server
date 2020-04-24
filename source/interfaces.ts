
export interface SubscriptionLink {
	userId: string
	subscriptionId: string
}

export interface StripeSubscriptionAssociate {
	link(options: SubscriptionLink): Promise<void>
	recallUserId(subscriptionId: string): Promise<string>
	recallSubscriptionId(userId: string): Promise<string>
}
