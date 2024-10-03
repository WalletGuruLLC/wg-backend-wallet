import { WebhookEventType } from 'src/api/wallet/dto/event-hook-type.enum';
import { IncomingPaymentCreatedEvent } from 'src/api/wallet/events/inconming-payment-created.event';
import { IncomingPaymentExpiredEvent } from 'src/api/wallet/events/inconming-payment-expired.event';
import { OutGoingPaymentCompletedEvent } from 'src/api/wallet/events/outgoing-payment-completed.event';
import { OutGoingPaymentCreatedEvent } from 'src/api/wallet/events/outgoing-payment-created.event';

export const hookEventMap = {
	[WebhookEventType.OutgoingPaymentCreated]: walletService =>
		new OutGoingPaymentCreatedEvent(walletService),
	[WebhookEventType.OutgoingPaymentCompleted]: walletService =>
		new OutGoingPaymentCompletedEvent(walletService),
	[WebhookEventType.IncomingPaymentCreated]: walletService =>
		new IncomingPaymentCreatedEvent(walletService),
	[WebhookEventType.IncomingPaymentExpired]: walletService =>
		new IncomingPaymentExpiredEvent(walletService),
};
