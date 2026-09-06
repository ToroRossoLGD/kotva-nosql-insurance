const fs=require('node:fs');
const{defineConfig,devices}=require('@playwright/test');
const localChrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

module.exports=defineConfig({
  testDir:'./test/e2e',
  fullyParallel:false,
  workers:1,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?[['github'],['html',{open:'never'}]]:'list',
  timeout:30000,
  expect:{timeout:7000},
  use:{
    baseURL:'http://127.0.0.1:3100',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],launchOptions:fs.existsSync(localChrome)?{executablePath:localChrome}:{}}}],
  webServer:{
    command:'node test/e2e-server.js',
    url:'http://127.0.0.1:3100/api/health',
    reuseExistingServer:!process.env.CI,
    timeout:30000
  }
});
