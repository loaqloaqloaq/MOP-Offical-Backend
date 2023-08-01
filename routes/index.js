var express = require('express');
var router = express.Router();
const youtube = require('../tools/youtube');

const puppeteer = require('puppeteer');
const { proxyRequest } = require('puppeteer-proxy');
const HttpsProxyAgent = require('https-proxy-agent');
const SocksProxyAgent = require('socks-proxy-agent');

const fs = require('fs');
const converter = require('json-2-csv');
var moment = require('moment');
const axios = require('axios').default;


const vtuber={
  aisu:'UCnwgM2M3C4JOVdOZ0OLu_bA',
  shizu:'UCEhykV_2vzBujoNWANH2-4Q',
}


/* GET home page. */
router.get('/', async function(req, res, next) {  
  var docker=process.env.docker||'false'
  res.send( docker ).end();
 });

router.get('/update', async function(req, res, next) {  
  const allDatas=await youtube.getAllYoutube()
  res.json(
    {
      message:"Update SUCCESS!!",
      length:allDatas.length,
      allDatas:allDatas
    }
  );

});

router.get('/test', async function(req, res, next) {  
  const allDatas=await youtube.test()
  res.json(
    {
      message:"Update SUCCESS!!",
      length:allDatas.length,
      allDatas:allDatas
    }
  );

});

router.get('/get', async function(req, res, next) {
  const allDatas=await youtube.getFirebaseData()
   res.json(
     {
       length:allDatas.length,
       data:allDatas
     }
   );
 
 });

 router.get('/getraw', async function(req, res, next) {
  const allDatas=await youtube.getRawFirebaseData()
   res.json(
     {
       length:allDatas.length,
       data:allDatas
     }
   );
 
 });


module.exports = router;
