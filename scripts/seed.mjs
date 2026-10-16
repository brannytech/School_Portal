import {db,save} from '../store.mjs';
save();
console.log(`Database ready: ${db.users.length} accounts. Existing data preserved.`);
