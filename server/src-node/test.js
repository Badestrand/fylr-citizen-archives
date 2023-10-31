const {evalExcessiveMarkings} = require('./markings/eval.js')
const {evalChatGPT} = require('./chatgpt/eval.js')
const {evalIsGerman} = require('./language/eval.js')
const {evalSentiment} = require('./sentiment/eval.js')
const {evalSpelling} = require('./spelling/eval.js')
const {stemmify} = require('./helpers.js')




async function evaluate(context, input) {
	const {text} = input

	const evalMethods = {
		chatgpt: evalChatGPT,
		sentiment: evalSentiment,
		german: evalIsGerman,
		markings: evalExcessiveMarkings,
		spelling: evalSpelling,
		// predefinedBlocklist: evalIsInPredefinedBlocklist,
		// customBlocklist: evalIsInCustomBlocklist,
	}

	const evaluations = {}

	/*
		const blocklist1 = getPresetBlocklist(context).split('\n').filter(line => line.trim().length > 0)
		const blocklist2 = context.config.customBlocklist
		const blocklist = [...blocklist1, ...blocklist2]
		const {text} = inputBody
		const stems = await stemmify(context, text)
		r = 'OKAY'
		for (const word of stems) {
			if (_.contains(blocklist, word.toLowerCase())) {
				r = 'BAD'
			}
		}
	*/

	const start = new Date().getTime()
	const stems = await stemmify(context, text)
	console.log('stemming', (new Date().getTime() - start) / 1000, 's')

	// Execute all evaluations in parallel
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
			switch (key) {
				case 'german':
					if (context.config.flagNonGermanEnabled && o.rating===false) {
						failed = true
					}
					break
				// case 'predefinedBlocklist':
				// case 'customBlocklist':
				// 	if (o.rating === false) {
				// 		failed = true
				// 	}
				// 	break
				default:
					o.threshold = context.config.evaluations[key].threshold / 100
					if (context.config.evaluations[key].enabled && o.rating>=o.threshold) {
						failed = true
					}
					break
			}
			evaluations[key] = o
		})
		allPromises.push(promise)
	}
	await Promise.all(allPromises)

	return {
		text,
		evaluations,
		failed,
	}
}



;(async () => {
	const start = new Date().getTime()
	try {
		const text = "hässlich schöner bau"
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
		console.log(x)
		console.log((new Date().getTime() - start) / 1000, 's')
	}
	catch (err) {
		console.log('ERROR: '+err.message)
	}
})();