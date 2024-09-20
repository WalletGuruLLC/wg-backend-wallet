import { createClient } from 'tigerbeetle-node';

export const tigerBeetleClient = createClient({
	cluster_id: BigInt(0),
	replica_addresses: [process.env.TB_ADDRESS || '18.191.192.12:4342'],
});
