const axios = require('axios')

const {evalExcessiveMarkings} = require('./markings/eval.js')
const {evalChatGPT} = require('./chatgpt/eval.js')
const {evalIsGerman} = require('./language/eval.js')
const {evalSentiment} = require('./sentiment/eval.js')
const {evalSpelling} = require('./spelling/eval.js')
const {stemmify} = require('./helpers.js')




async function wait(s) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, s*1000)
	})
}


async function fetchApi(s) {
	console.log((await axios.get('https://hub.dummyapis.com/delay?seconds='+s)).data)
}




async function evaluate(context, input) {
	const {text} = input

	const evalMethods = {
		chatgpt1: evalChatGPT,
		chatgpt2: evalChatGPT,
		chatgpt3: evalChatGPT,
		spelling: evalSpelling,
	}
		// german: evalIsGerman,

	const evaluations = {}

	const start = new Date().getTime()
	const stems = await stemmify(context, text)
	console.log('stemming', (new Date().getTime() - start) / 1000, 's')

	const allPromises = []
	let failed = false
	for (const key in evalMethods) {
		let o = {}
		const promise = evalMethods[key](context, text, {stems})
		promise.then((result) => {
			o = result
		})
		promise.catch((err) => {
			o.error = err.response?.data?.error?.message ?? err.message
		})
		promise.finally(() => {
			evaluations[key] = o
		})
		allPromises.push(promise)
	}
	console.log('waiting for all now', (new Date().getTime() - start) / 1000, 's')
	await Promise.all(allPromises)
	console.log('waiting done', (new Date().getTime() - start) / 1000, 's')

	return {
		text,
		evaluations,
		failed,
	}

	// const methods = [
	// 	async () => await fetchApi(4),
	// 	async () => await fetchApi(4),
	// 	async () => await fetchApi(4),
	// ]

	// // Execute all evaluations in parallel
	// const allPromises = []
	// for (const f of methods) {
	// 	const promise = f()
	// 	promise.then(() => {
	// 	})
	// 	allPromises.push(promise)
	// }
	// await Promise.all(allPromises)
}



;(async () => {
	const start = new Date().getTime()
	try {
		const text = "hässlich schönerr bau"
		const context = {
			config: {
				"applyFields": [{
					"model": 4,
					"field": 7,
					"trigger-tag": null,
					"marking-tag": 1
				}],
				"evaluations": {
					"chatgpt": {
						"enabled": true,
						"threshold": 50
					},
					"sentiment": {
						"enabled": true,
						"threshold": 50
					},
					"markings": {
						"enabled": true,
						"threshold": 50
					},
					"spelling": {
						"enabled": true,
						"threshold": 50
					}
				},
				"rateLimitingEnabled": true,
				"flagNonGermanEnabled": true,
				"flagRepeatOffendersAfterN": 3,
				"apikeyOpenAI": "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",
				"apikeyDetectLanguage": "349133d80d3409c4123d9abbf77e263d",
				"customBlocklist": ["Arsch", "doof", "Pissnelke", "Luder", "Idiot", "Hurensohn", "Hackfresse"],
			},
			serverPath: '..'
		}
		const x = await evaluate(context, {text})
		console.log(JSON.stringify(x, null, 4))
		console.log((new Date().getTime() - start) / 1000, 's')
	}
	catch (err) {
		console.log('ERROR: '+err.message)
	}
})();