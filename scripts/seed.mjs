import {db,save,sql} from '../store.mjs';
await save();console.log('Database ready: '+db.users.length+' accounts.');await sql.close();
