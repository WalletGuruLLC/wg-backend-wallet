import { WebhookEventType } from 'src/api/wallet/dto/event-hook-type.enum';
import { IncomingPaymentCompletedEvent } from 'src/api/wallet/events/inconming-payment-completed.event';
import { IncomingPaymentCreatedEvent } from 'src/api/wallet/events/inconming-payment-created.event';
import { IncomingPaymentExpiredEvent } from 'src/api/wallet/events/inconming-payment-expired.event';
import { OutGoingPaymentCompletedEvent } from 'src/api/wallet/events/outgoing-payment-completed.event';
import { OutGoingPaymentCreatedEvent } from 'src/api/wallet/events/outgoing-payment-created.event';

export const hookEventMap = {
	[WebhookEventType.OutgoingPaymentCreated]: walletService =>
		new OutGoingPaymentCreatedEvent(walletService),
	[WebhookEventType.OutgoingPaymentCompleted]: (walletService, userWsGateway) =>
		new OutGoingPaymentCompletedEvent(walletService, userWsGateway),
	[WebhookEventType.IncomingPaymentCreated]: (walletService, userWsGateway) =>
		new IncomingPaymentCreatedEvent(walletService, userWsGateway),
	[WebhookEventType.IncomingPaymentExpired]: walletService =>
		new IncomingPaymentExpiredEvent(walletService),
	[WebhookEventType.IncomingPaymentCompleted]: walletService =>
		new IncomingPaymentCompletedEvent(walletService),
};
