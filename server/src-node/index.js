const _ = require('underscore')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const {exec} = require('child_process')
const {stemmify} = require('./helpers.js')
const {evalExcessiveMarkings} = require('./markings/eval.js')
const {evalChatGPT} = require('./chatgpt/eval.js')
const {evalIsGerman} = require('./language/eval.js')
const {evalSentiment} = require('./sentiment/eval.js')
const {evalSpelling} = require('./spelling/eval.js')






function getPresetBlocklist(context) {
	return fs.readFileSync(context.serverPath+'/data/bad-words-de.txt', 'utf8')
}




function listFilesInDirectorySync(directoryPath) {
	let allPaths = []
	const files = fs.readdirSync(directoryPath)
	files.forEach((file) => {
		const filePath = path.join(directoryPath, file)
		const stats = fs.statSync(filePath)
		if (stats.isDirectory()) {
			const newPaths = listFilesInDirectorySync(filePath)
			allPaths = [...allPaths, ...newPaths]
		}
		else {
			allPaths.push(filePath)
		}
	})
	return allPaths
}




let predefinedBlocklistWords = null

async function evalIsInPredefinedBlocklist(context, text, {stems}) {
	const start = new Date().getTime()
	const matches = []
	if ( ! predefinedBlocklistWords) {
		predefinedBlocklistWords = getPresetBlocklist(context).split('\n').filter(line => line.trim().length > 0).map(line => line.toLowerCase())
	}
	for (const word of stems) {
		if (_.contains(predefinedBlocklistWords, word.toLowerCase())) {
			matches.push(word)
		}
	}
	return {
		rating: matches.length===0,
		details: {
			'Matches': matches,
		},
		time: (new Date().getTime() - start) / 1000,
	}
}

async function evalIsInCustomBlocklist(context, text, {stems}) {
	const start = new Date().getTime()
	const matches = []
	const cleanBlocklist = context.config.customBlocklist.map(line => line.trim().toLowerCase())
	for (const word of stems) {
		if (_.contains(cleanBlocklist, word.toLowerCase())) {
			matches.push(word)
		}
	}
	return {
		rating: matches.length===0,
		details: {
			'Matches': matches,
		},
		time: (new Date().getTime() - start) / 1000,
	}
}




async function evaluate(context, input) {
	const {text} = input

	const evalMethods = {
		chatgpt: evalChatGPT,
		sentiment: evalSentiment,
		german: evalIsGerman,
		markings: evalExcessiveMarkings,
		spelling: evalSpelling,
		predefinedBlocklist: evalIsInPredefinedBlocklist,
		customBlocklist: evalIsInCustomBlocklist,
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

	const stems = await stemmify(context, text)

	// Execute all evaluations in parallel
	const allPromises = []
	const result = {
		text,
		evaluations,
		failed,
	}
	for (const key in evalMethods) {
		let o = {}
		const promise = evalMethods[key](context, text, {stems})
		promise.then((r) => {
			o = r
		})
		.catch((err) => {
			o.error = err.response?.data?.error?.message ?? err.message
		})
		.finally(() => {
			switch (key) {
				case 'german':
					if (context.config.flagNonGermanEnabled && o.rating===false) {
						result.failed = true
					}
					break
				case 'predefinedBlocklist':
				case 'customBlocklist':
					if (o.rating === false) {
						result.failed = true
					}
					break
				default:
					o.threshold = context.config.evaluations[key].threshold / 100
					if (context.config.evaluations[key].enabled && o.rating>=o.threshold) {
						result.failed = true
					}
					break
			}
			result.evaluations[key] = o
		})
		allPromises.push(promise)
	}
	await Promise.all(allPromises)

	return result
}




const MAX_CHUNK_SIZE = 10000;

function logLongString(longString) {
	let chunks = [];
	for (let i = 0; i < longString.length; i += MAX_CHUNK_SIZE) {
		chunks.push(longString.substring(i, i + MAX_CHUNK_SIZE));
	}
	for (let i = 0; i < chunks.length; i++) {
		process.stdout.write(chunks[i]);
	}
}



function getCurrentSchemaFromAPI(env) {
	return new Promise((resolve, reject) => {
		var url = env.api_url + '/api/v1/schema/user/CURRENT?access_token=' + env.api_user_access_token
		fetch(url, {
			headers: {
				'Accept': 'application/json'
			},
		})
		.then(response => {
			if (response.ok) {
				resolve(response.json())
			} else {
				reject("Fehler bei der Anfrage an /schema/user/CURRENT ", '')
			}
		})
		.catch(error => {
			console.error(error);
			reject("Fehler bei der Anfrage an /schema/user/CURRENT ", '')
		})
	})
}


async function getSessionInfoFromAPI(env) {
	const data = await fetch(env.api_url + '/api/v1/user/session?access_token=' + env.api_user_access_token, {
		headers: {
			'Accept': 'application/json'
		},
	})
	if ( ! data.ok) {
		throw new Error("Fehler bei der Anfrage an /api/v1/user/session")
	}
	return data.json()
}


async function getUserInfoFromAPI(env, userId) {
	const data = await fetch(env.api_url + '/api/v1/user/'+userId+'?access_token=' + env.api_user_access_token, {
		headers: {
			'Accept': 'application/json'
		},
	})
	if ( ! data.ok) {
		throw new Error("Fehler bei der Anfrage an /api/v1/user")
	}
	return data.json()
}


async function updateUserCustomData(env, user) {
	const data = await fetch(env.api_url + '/api/v1/user?access_token=' + env.api_user_access_token, {
		method: 'POST',
		headers: {
			'Accept': 'application/json'
		},
		body: JSON.stringify([{
			"_basetype": "user",
			"user": {
				"_id": user._id,
				"custom_data": user.custom_data,
				"_version": user._version + 1
			}
		}])
	})
	// console.error("SAVING USER'S CUSTOM DATA", JSON.stringify(user.custom_data))
	if ( ! data.ok) {
		throw new Error('Fehler bei der Anfrage an /api/v1/user')
	}
}





let rawInput = ''

process.stdin.on('data', d => {
	try {
		rawInput += d.toString();
	} catch (e) {
		console.error(`Could not read input into string: ${e.message}`, e.stack);
		process.exit(1);
	}
})


process.stdin.on('end', async () => {
	try {
		let inputBody = null
		if (rawInput.length) {
			try {
				inputBody = JSON.parse(rawInput)
			} catch (e) {
				console.error(`Could not parse input: ${e.message}`, e.stack);
				process.exit(1);
			}
		}

		const pluginDirectory = process.argv[2]
		const fylrEnv = JSON.parse(process.argv[3])
		const scriptCommand = process.argv[4]
		const context = {
			serverPath: pluginDirectory+'/server',
		}

		// extract config
		const rawFylrConfig = fylrEnv?.config?.plugin?.citizenarchives?.config
		if (rawFylrConfig) {
			context.config = {
				// `fields` for which objects to check and which tags to check and set. Is an array with each element
				//   looking like {model: 2, field: 4, 'trigger-tag': 3, 'marking-tag': 1}.
				applyFields: (JSON.parse(rawFylrConfig['citizenarchives-base'].fields_chooser)?.data_table ?? []),

				evaluations: {
					chatgpt: {
						enabled: rawFylrConfig['citizenarchives-criterias'].chatgpt_enabled,
						threshold: rawFylrConfig['citizenarchives-criterias'].chatgpt_threshold,
					},
					sentiment: {
						enabled: rawFylrConfig['citizenarchives-criterias'].sentiment_enabled,
						threshold: rawFylrConfig['citizenarchives-criterias'].sentiment_threshold,
					},
					markings: {
						enabled: rawFylrConfig['citizenarchives-criterias'].markings_enabled,
						threshold: rawFylrConfig['citizenarchives-criterias'].markings_threshold,
					},
					spelling: {
						enabled: rawFylrConfig['citizenarchives-criterias'].spelling_enabled,
						threshold: rawFylrConfig['citizenarchives-criterias'].spelling_threshold,
					},
				},
				rateLimitingEnabled: rawFylrConfig['citizenarchives-criterias'].rate_limiting_enabled,
				flagNonGermanEnabled: rawFylrConfig['citizenarchives-criterias'].nongerman_flag_enabled,
				flagRepeatOffendersAfterN: rawFylrConfig['citizenarchives-criterias'].repeated_offender_enabled,

				apikeyOpenAI: rawFylrConfig['citizenarchives-misc'].openai_apikey,
				apikeyDetectLanguage: rawFylrConfig['citizenarchives-misc'].detectlanguage_apikey,
				customBlocklist: rawFylrConfig['citizenarchives-misc'].own_blocklist.split('\n').filter(line => line.trim().length > 0),
			}
		}
		else {
			context.config = {
				apikeyOpenAI: process.env.OPENAI_API_KEY,
				apikeyDetectLanguage: process.env.DETECTLANGUAGE_APIKEY,
			}
		}


		let r
		switch (scriptCommand) {
			// case 'config':
			// 	r = context.config
			// 	r.userSession = await getSessionInfoFromAPI(fylrEnv)
			// 	r.userInfo = await getUserInfoFromAPI(fylrEnv, r.userSession.user.user._id)
			// 	break

			// case 'env':
			// 	r = fylrEnv
			// 	break

			case 'get-preset-blocklist':
				r = getPresetBlocklist(context)
				break

			case 'evaluate':
				r = await evaluate(context, inputBody)
				break

			case 'saving': {
				// console.error('Citizen Archives: Check for analyzing entries')//, JSON.stringify(inputBody.objects))
				try {
					let isRepeatOffender = false

					// check whether this user already has too many tagged entries and thus gets auto-tagged
					const userSession = await getSessionInfoFromAPI(fylrEnv)
					const userInfo = await getUserInfoFromAPI(fylrEnv, userSession.user.user._id)
					const user = userInfo[0].user
					const alreadyTaggedCount = user.custom_data?.citizenarchives__already_tagged_count ?? 0  // TODO: Test that it works without plugin and with a new new then activate plugin again
					if (alreadyTaggedCount >= context.config.flagRepeatOffendersAfterN) {
						isRepeatOffender = true
					}

					// check and handle spam
					let isSpamming = false
					if (context.config.rateLimitingEnabled) {
						const MAX_DAY=1000, MAX_HOUR=100, MAX_MINUTE=8

						const now = new Date()
						const thisDay    = now.getFullYear() + '-' + ('0'+(now.getMonth()+1)).slice(-2) + '-' + ('0'+now.getDate()).slice(-2)
						const thisHour   = now.getFullYear() + '-' + ('0'+(now.getMonth()+1)).slice(-2) + '-' + ('0'+now.getDate()).slice(-2) + ' ' + ('0' + now.getHours()).slice(-2)
						const thisMinute = now.getFullYear() + '-' + ('0'+(now.getMonth()+1)).slice(-2) + '-' + ('0'+now.getDate()).slice(-2) + ' ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2)

						const checkIsSpamAndIncCount = (user, thisTime, propTime, propCount, maxCount) => {
							let isSpamming = false
							const customData = user.custom_data ?? {}
							const crntCount = customData[propCount] ?? 0
							const crntTime = customData[propTime] ?? ''
							if (crntTime === thisTime) {
								isSpamming = crntCount >= maxCount
								customData[propCount] = crntCount + 1
							}
							else {
								customData[propTime] = thisTime
								customData[propCount] = 0
							}
						}

						isSpamming = checkIsSpamAndIncCount(user, thisDay, 'citizenarchives__submitted_day_crnt', 'citizenarchives__submitted_day', MAX_DAY) || 
							checkIsSpamAndIncCount(user, thisHour, 'citizenarchives__submitted_hour_crnt', 'citizenarchives__submitted_hour', MAX_HOUR) || 
							checkIsSpamAndIncCount(user, thisMinute, 'citizenarchives__submitted_minute_crnt', 'citizenarchives__submitted_minute', MAX_MINUTE)
						// console.error('checked rates, isSpamming=', isSpamming, 'user=', user)
					}

					// check 
					const allModelIdsToCheck = context.config.applyFields.map(entry => entry.model)
					const schema = await getCurrentSchemaFromAPI(fylrEnv)
					for (const newObject of inputBody.objects) {
						// find model id
						let tableName = null
						let newObjectTableId = null
						for (const table of schema.tables) {
							if (table.name === newObject._objecttype) {
								newObjectTableId = table.table_id
								tableName = table.name
								break
							}
						}
						if ( ! newObjectTableId) {
							console.error("...can't find new object's table id for "+newObject._objecttype)
							continue
						}
						for (const check of context.config.applyFields) {
							// invalid entry?
							if (check.model===null || check.field===null || check['marking-tag']===null) {
								// console.error("...no match: Invalid check")
								continue
							}
							// no match for object type?
							if (check.model !== newObjectTableId) {
								// console.error("...no match: Different object type")
								continue
							}
							// no match for trigger tag?
							if (check['trigger-tag']!==null && newObject._tags.map(tag => tag._id).indexOf(check['trigger-tag']) === -1) {
								// console.error("...no match: Trigger tag not set on this entry")
								continue
							}
							let doTagEntry = isRepeatOffender || isSpamming
							if (isRepeatOffender) {
								// console.error("...flagged because repeat offender")
							}
							if (isSpamming) {
								// console.error("...flagged because spam rate exceeded")
							}
							if ( ! doTagEntry) {
								// console.error("...will evaluate")
								// 
								let columnName = null
								for (const table of schema.tables) {
									if (table.table_id !== check.model) {
										continue
									}
									for (const column of table.columns) {
										if (column.column_id === check.field) {
											columnName = column.name
											break
										}
									}
									if (columnName) {
										break
									}
								}
								if ( ! columnName) {
									console.error("...no match: Can't find column "+check.field)
									continue
								}
								const textToCheck = newObject[tableName][columnName]

								const evaluation = await evaluate(context, {text: textToCheck})
								// console.error('...evaluation: '+(evaluation.failed? 'FAILED' : 'PASSED'), JSON.stringify(evaluation))
								if (evaluation.failed) {
									doTagEntry = true
								}
							}
							if (doTagEntry) {
								// add marking tags
								const newTagId = check['marking-tag']
								newObject._tags.push({
									_id: newTagId
								})
								// increase tagged count for user
								if (typeof user.custom_data.citizenarchives__already_tagged_count === 'undefined') {
									user.custom_data.citizenarchives__already_tagged_count = 0
								}
								user.custom_data.citizenarchives__already_tagged_count += 1
							}
						}
					}
					await updateUserCustomData(fylrEnv, user)
				}
				catch (err) {
					console.error("...error", err.message)
				}
				const result = {objects: inputBody.objects}
				// console.error('RESULT', JSON.stringify(result))
				console.log(JSON.stringify(result))
			} break


			default:
				console.log("Unknown or missing command", scriptCommand)
		}

		if (typeof r === 'string') {
			console.log(r)
		}
		else if (typeof r === 'object') {
			console.log(JSON.stringify(r, null, 4))
		}
	}
	catch (err) {
		console.log(JSON.stringify({
			error: err.message,
		}, null, 4))
	}
})









const promisifiedExec = promisify(exec)



function loadTextFileLines(path) {
	const content = fs.readFileSync(path, 'utf8')
	let lines = content.split("\n")
	lines = lines.map(line => line.trim())
	lines = lines.filter(line => line.length>0)
	return lines
}


// by ChatGPT
function escapeShellArg(arg) {
	// If the string contains spaces, double quotes, parentheses, or backslashes,
	// then we enclose the string in single quotes and escape any contained double quotes and backslashes.
	if (/[ "'()\\]/.test(arg)) {
		return `'${arg.replace(/(['"\\])/g, '\\$1')}'`;
	}
	// Otherwise, we return the string as is.
	return arg;
}


async function stem(text) {
	// do the stemming
	let stems
	const pythonExecPath = process.env.PYTHON_EXEC ?? 'python'
	try {
		const {stdout} = await promisifiedExec(pythonExecPath+' sentiment/stem.py '+escapeShellArg(text))
		stems = JSON.parse(stdout)
	}
	catch (err) {
		throw new Error("Error when stemming: "+err.stderr)
	}

	return stems
}
