process.env.USE_ARANGO='false';
process.env.PORT='3100';
process.env.JWT_SECRET='playwright-test-secret';

const{start}=require('../server');

start(3100).then(server=>{
  const shutdown=()=>server.close(()=>process.exit(0));
  process.on('SIGTERM',shutdown);
  process.on('SIGINT',shutdown);
}).catch(error=>{
  console.error(error);
  process.exit(1);
});
