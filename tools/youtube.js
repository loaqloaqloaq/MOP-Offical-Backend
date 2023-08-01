const cheerio = require('cheerio');
const firebase = require("firebase/app");
const {  getDatabase, ref, child, get, set } =require("firebase/database");
require('dotenv').config({path: './.env'});

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: process.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.PUBLIC_FIREBASE_MEASUREMENT_ID
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const puppeteer = require('puppeteer');

const axios = require('axios').default;

const vtuber={
  aisu:'UCnwgM2M3C4JOVdOZ0OLu_bA',
  shizu:'UCEhykV_2vzBujoNWANH2-4Q',
}

module.exports = {
    scrape_youtube,
    parse,
    scrapeYouTubeChannelVideos,
		getAllYoutube,
		getFirebaseData,
    getRawFirebaseData,
    test
};

const all_videos = new Set();

const sleep = seconds =>
    new Promise(resolve => setTimeout(resolve, (seconds || 1) * 1000));

async function scrape_youtube(browser, keywords) {

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('https://www.youtube.com');

    try {
        await page.waitForSelector('input[id="search"]', { timeout: 5000 });
    } catch (e) {
        return results;
    }

    const results = {};

    // before we do anything, parse the results of the front page of youtube
    await page.waitForSelector('ytd-video-renderer,ytd-grid-video-renderer', { timeout: 10000 });
    let html = await page.content();
    results['__frontpage__'] = parse(html);

    for (var i = 0; i < keywords.length; i++) {

        keyword = keywords[i];

        try {
            const input = await page.$('input[id="search"]');
            // overwrites last text in input
            await input.click({ clickCount: 3 });
            await input.type(keyword);
            await input.focus();
            await page.keyboard.press("Enter");

            await page.waitForFunction(`document.title.indexOf('${keyword}') !== -1`, { timeout: 5000 });
            await page.waitForSelector('ytd-video-renderer,ytd-grid-video-renderer', { timeout: 5000 });
            await sleep(1);

            let html = await page.content();
            results[keyword] = parse(html);

        } catch (e) {
            console.error(`Problem with scraping ${keyword}: ${e}`);
        }
    }

    return results;
}

function parse(html) {
    // load the page source into cheerio
    const $ = cheerio.load(html);

    // perform queries
    const results = [];
    $('#dismissible.style-scope.ytd-rich-grid-media').each((i, link) => {
        results.push({
            link: $(link).find('#video-title').attr('href'),
            title: $(link).find('#video-title').text(),
            snippet: $(link).find('#description-text').text(),
            channel: $(link).find('#byline a').text(),
            channel_link: $(link).find('#byline a').attr('href'),
            num_views: $(link).find('#metadata-line span:nth-child(1)').text(),
            release_date: $(link).find('#metadata-line span:nth-child(2)').text(),
        })
    });

    const cleaned = [];
    for (var i=0; i < results.length; i++) {
        let res = results[i];
        if (res.link && res.link.trim() && res.title && res.title.trim()) {
            res.title = res.title.trim();
            res.snippet = res.snippet.trim();
            res.rank = i+1;

            // check if this result has been used before
            if (all_videos.has(res.title) === false) {
                cleaned.push(res);
            }
            all_videos.add(res.title);
        }
    }

    return {
        time: (new Date()).toUTCString(),
        results: cleaned,
    }
}

/*
async function scrapeYouTubeChannelVideos(channelUrl,browser) {    
    const page = await browser.newPage();
    
    // Navigate to the channel URL
    await page.goto(channelUrl,{waitUntil: "networkidle0"});
    
    // Wait for the video list to load
    await page.waitForSelector('#dismissible');    

    // Scrape the video list    
    const videoList = await page.evaluate(() => {
      const videos = [];
      const videoElements = document.querySelectorAll('#dismissible.style-scope.ytd-rich-grid-media');
      
      videoElements.forEach((element) => {
        const titleElement = element.querySelector('#video-title-link');
        const videoId = titleElement.getAttribute('href')?.replace('/watch?v=','')||'';
        const title = titleElement?.getAttribute('title') || 'N/A';
        
        videos.push({ videoId, title });
      });
      
      return videos;
    });        
   
    return videoList;
  }

  */

async function scrapeYouTubeChannelVideos(channelUrl,browser) {
	// Scrape the video list
	const videoList = [];
	const page = await browser.newPage();
	await page.setViewport({
		width: 1920,
		height: 9999,
		deviceScaleFactor: 1,
	});
	for(var url of channelUrl){		  
		// Navigate to the channel URL
		await page.goto(url,{waitUntil: "networkidle0"});
		
		// Wait for the video list to load
		await page.waitForSelector('#dismissible.style-scope.ytd-rich-grid-media');  

		// Get the HTML content of the page
		const htmlContent = await page.content();

		// Load the HTML content into Cheerio
		const $ = cheerio.load(htmlContent);    
		
		$('#dismissible.style-scope.ytd-rich-grid-media').each((index, element) => {
			const $video = $(element);        
			const videoId = $video.find('#video-title-link').attr('href').replace('/watch?v=','');  
			if(index < 30) videoList.push( videoId );
			else return false
		});		
	}
	

	return videoList;
}

async function test(){

}

async function getAllYoutube(){
	const isDocker=process.env.docker=='true';
	var config={
    headless: true,
    args: [`--window-size=1920,1080`],
  };
	if(isDocker) {
		config.executablePath='/usr/bin/google-chrome';
		config.args.push('--no-sandbox', '--disable-setuid-sandbox');
	}
	const browser = await puppeteer.launch(config);   
 
  var channelUrl=[]
  for(var name in vtuber){
    channelUrl.push(`https://www.youtube.com/channel/${vtuber[name]}/streams`);
    channelUrl.push(`https://www.youtube.com/channel/${vtuber[name]}/videos`);
  } 
  var results=await scrapeYouTubeChannelVideos(channelUrl,browser);  
  browser.close();
    
  const firstHalf = results.slice(0, 50).join(',')
  const secondHalf = results.slice(50,100).join(',')
  
  var allDatas=[];
  
  const url='https://www.googleapis.com/youtube/v3/videos?key=AIzaSyC5xBFv5-MI5au4aQvFY2xe-VcoofbGZMM&part=snippet,liveStreamingDetails&id='
  const halt1=await axios.get(url+firstHalf).then((response) => response.data).catch(err => console.log(err))
  const half2=await axios.get(url+secondHalf).then((response) => response.data).catch(err => console.log(err))
  allDatas=halt1.items.concat(half2.items)

	if(allDatas.length>0){
    //const dbDatas= await getRawFirebaseData();
    
    const db = getDatabase();  
  	const dbRef = ref(db);
    var oldestDate=new Date();
		for(var item of allDatas){
			delete item.snippet.description
			delete item.snippet.tags
			delete item.snippet.categoryId
			delete item.snippet.localized
      var date
      if(item.liveStreamingDetails) date=item.liveStreamingDetails.scheduledStartTime
      else date=item.snippet.publishedAt
      oldestDate=oldestDate>new Date(date)?new Date(date):oldestDate;      
      set(child(dbRef, `videoList/list/${item.id}`), item);		  
		}  
		 
    var allDbDatas= await getFirebaseData();
    allDbDatas=allDbDatas.filter(a=>new Date(a.date)>oldestDate);   
		for(const data of allDbDatas){
      if(!results.includes(data.id)){
        set(child(dbRef, `videoList/list/${data.id}`), null);	
      }
    }
    set(child(dbRef, 'videoList/lastUpdate'), new Date().toISOString());
	}

  

	return allDatas;
}

const ignoreIds=['rWnaGgnpukk','gV_0FWdkRlk']
async function getFirebaseData(){
	const db = getDatabase();  
	const dbRef = ref(db);  
	var resRaw=await get(child(dbRef, `videoList`)).then((snapshot) => {
		if (snapshot.exists()) {            
			return snapshot.val();
		} else {
			return false
		}
	}).catch((error) => {
		console.error(error);
		return false
	});
  var filtered;
  if(Array.isArray(resRaw.list)){
    filtered= resRaw.list.filter(l=>!ignoreIds.includes(l.id))
  }else{
    filtered= Object.values(resRaw.list).filter(l=>!ignoreIds.includes(l.id))
  }

  const results = filtered.sort(function(a,b){
    // Turn your strings into dates, and then subtract them
    // to get a value that is either negative, positive, or zero.
    var aDate,bDate;

    if(a.liveStreamingDetails) aDate=a.liveStreamingDetails.scheduledStartTime
    else aDate=a.snippet.publishedAt

    a.date=aDate

    if(b.liveStreamingDetails) bDate=b.liveStreamingDetails.scheduledStartTime
    else bDate=b.snippet.publishedAt

    b.date=bDate

    return new Date(bDate) - new Date(aDate);
  });

	return results
}

async function getRawFirebaseData(){
	const db = getDatabase();  
	const dbRef = ref(db);  
	var resRaw=await get(child(dbRef, `videoList`)).then((snapshot) => {
		if (snapshot.exists()) {            
			return snapshot.val();
		} else {
			return false
		}
	}).catch((error) => {
		console.error(error);
		return false
	});
  var filtered;
  if(Array.isArray(resRaw.list)){
    filtered= resRaw.list.filter(l=>!ignoreIds.includes(l.id))
    var tmp={}
    for(const i of filtered){
      tmp[i.id]=i;
    }
    filtered=tmp;
  }else{
    const asArray = Object.entries( resRaw.list );
    const filteredArray = asArray.filter(([key, value]) =>  !ignoreIds.includes(value.id));
    filtered=Object.fromEntries(filteredArray);
  }

	return filtered
}

