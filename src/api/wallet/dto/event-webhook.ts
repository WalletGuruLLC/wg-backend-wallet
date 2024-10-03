import { EventWebHookDTO } from './event-hook.dto';

export interface EventWebHook {
	trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void>;
}
