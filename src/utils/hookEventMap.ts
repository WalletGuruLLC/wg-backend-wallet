import { WebhookEventType } from 'src/api/wallet/dto/event-hook-type.enum';
import { IncomingPaymentCompletedEvent } from 'src/api/wallet/events/inconming-payment-completed.event';
import { IncomingPaymentCreatedEvent } from 'src/api/wallet/events/inconming-payment-created.event';
import { IncomingPaymentExpiredEvent } from 'src/api/wallet/events/inconming-payment-expired.event';
import { OutGoingPaymentCompletedEvent } from 'src/api/wallet/events/outgoing-payment-completed.event';
import { OutGoingPaymentCreatedEvent } from 'src/api/wallet/events/outgoing-payment-created.event';

export const hookEventMap = {
	[WebhookEventType.OutgoingPaymentCreated]: new OutGoingPaymentCreatedEvent(),
	[WebhookEventType.OutgoingPaymentCompleted]:
		new OutGoingPaymentCompletedEvent(),
	[WebhookEventType.IncomingPaymentCreated]: new IncomingPaymentCreatedEvent(),
	[WebhookEventType.IncomingPaymentCompleted]:
		new IncomingPaymentCompletedEvent(),
	[WebhookEventType.IncomingPaymentExpired]: new IncomingPaymentExpiredEvent(),
};
