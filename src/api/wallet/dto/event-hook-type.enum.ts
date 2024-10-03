export enum WebhookEventType {
	IncomingPaymentCreated = 'incoming_payment.created',
	IncomingPaymentCompleted = 'incoming_payment.completed',
	IncomingPaymentExpired = 'incoming_payment.expired',
	OutgoingPaymentCreated = 'outgoing_payment.created',
	OutgoingPaymentCompleted = 'outgoing_payment.completed',
	OutgoingPaymentFailed = 'outgoing_payment.failed',
	WalletAddressWebMonetization = 'wallet_address.web_monetization',
	WalletAddressNotFound = 'wallet_address.not_found',
	AssetLiquidityLow = 'asset.liquidity_low',
	PeerLiquidityLow = 'peer.liquidity_low',
}
