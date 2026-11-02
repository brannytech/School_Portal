// Optional: run a test against a real Postgres. Set TEST_POSTGRES_URL to a server where the role may create databases,
// for example postgres://postgres@127.0.0.1:5432/postgres. Each test gets its own empty database that is dropped afterwards.
export async function freshDatabase(){
 const admin=process.env.TEST_POSTGRES_URL;if(!admin)return null;
 const {Client}=await import('pg');const name='lab_test_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
 const client=new Client({connectionString:admin});await client.connect();await client.query(`CREATE DATABASE ${name}`);await client.end();
 const url=new URL(admin);url.pathname='/'+name;
 return {url:url.toString(),async cleanup(){const c=new Client({connectionString:admin});await c.connect();await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await c.end();}};
}
