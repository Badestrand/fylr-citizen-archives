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
				case 'predefinedBlocklist':
				case 'customBlocklist':
					if (o.rating === false) {
						failed = true
					}
					break
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



async function increaseUserAlreadyTaggedCount(env) {
	const session = await getSessionInfoFromAPI(env)
	const user = await getUserInfoFromAPI(env, session.user.user._id)
	// const prevCount = userInfo[0]?.user?.custom_data?.citizenarchives__already_tagged_count ?? 0
	// const nextCount = prevCount + 1
	// user[0].user.custom_data.citizenarchives__already_tagged_count = nextCount

	const data = await fetch(env.api_url + '/api/v1/user?access_token=' + env.api_user_access_token, {
		method: 'POST',
		headers: {
			'Accept': 'application/json'
		},
		body: JSON.stringify([{
			"_basetype": "user",
			"user": {
				"_id": user[0].user._id,
				"custom_data": {
					...user[0].user.custom_data,
					"citizenarchives__already_tagged_count": (user[0].user.custom_data.citizenarchives__already_tagged_count ?? 0) + 1
				},
				"_version": user[0].user._version + 1
			}
		}])
	})
	if ( ! data.ok) {
		throw new Error("Fehler bei der Anfrage an /api/v1/user")
	}
}


/*
POST https://fylr.datahive.one/api/v1/user

[
   {
	  "_basetype": "user",
	  "user": {
		 "_id": 5,
		 "custom_data": {
			"orcid": "",
			"citizenarchives__already_tagged_count": 112
		 },
		 "login": "test",
		 "last_name": "Test",
		 "type": "easydb",
		 "frontend_language": "de-DE",
		 "database_languages": [
			"de-DE",
			"en-US"
		 ],
		 "search_languages": [],
		 "first_name": "Test",
		 "displayname": "",
		 "mail_schedule": {
			"timezone": "Europe/Berlin",
			"_preset": "custom",
			"days_of_month": [],
			"weekdays": [],
			"hours": []
		 },
		 "company": "",
		 "department": "",
		 "phone": "",
		 "reference": "",
		 "remarks": "",
		 "address_supplement": "",
		 "street": "",
		 "house_number": "",
		 "postal_code": "",
		 "town": "",
		 "country": "",
		 "email": "",
		 "state": "",
		 "login_disabled": false,
		 "require_password_change": false,
		 "welcome_email": false,
		 "confirm_email": false,
		 "login_valid_from": null,
		 "login_valid_to": null,
		 "frontend_prefs": {
			"webfrontend": {
			   "choice_table_id": 4,
			   "ignore_duplicate_dialog": false,
			   "languages_user_selection": false,
			   "quick_access_open": true,
			   "recognize_series": true,
			   "search_type_selector": {
				  "objecttypes": [
					 "baum",
					 "gebaeude"
				  ],
				  "pool_ids": []
			   },
			   "show_languages_with_data": true,
			   "spellcheck": false
			}
		 },
		 "picture": null,
		 "_version": 14
	  },
	  "_groups": [
		 {
			"_basetype": "group",
			"group": {
			   "_id": 10
			}
		 }
	  ],
	  "_acl": [],
	  "_system_rights": {},
	  "_collection_pin_codes": []
   }
]*/



// const TEST_OBJECTS = [{
//     "_callback_context": {
//         "hash": "e7f0ac1a-61f8-4be6-86f4-8b98999ff309",
//         "original_mask": "user_comment__all_fields"
//     },
//     "_collections": [],
//     "_comment": "",
//     "_create_user": null,
//     "_current": null,
//     "_format": "long",
//     "_last_modified": "0001-01-01T00:00:00Z",
//     "_latest_version": false,
//     "_mask": "_all_fields",
//     "_mask_display_name": {
//         "und": "_all_fields"
//     },
//     "_objecttype": "user_comment",
//     "_objecttype_display_name": {
//         "de-DE": "Nutzerkommentare",
//         "en-US": "User comments"
//     },
//     "_owner": null,
//     "_published": [],
//     "_published_count": 0,
//     "_standard": {
//         "1": {
//             "text": {
//                 "de-DE": "Kööööln",
//                 "en-US": "Kööööln"
//             },
//             "html": {
//                 "de-DE": "<span class=\"ez-format-comma>Kööööln</span>",
//                 "en-US": "<span class=\"ez-format-comma>Kööööln</span>"
//             }
//         }
//     },
//     "_system_object_id": 0,
//     "_tags": [{
//         "_id": 3,
//         "displayname": {
//             "de-DE": "Neuer Beitrag",
//             "en-US": "New entry"
//         }
//     }],
//     "_uuid": "",
//     "user_comment": {
//         "_version": 1,
//         "comment": "Kööööln"
//     }
// }]




/*let rawInput = ''

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
			case 'config':
				r = context.config
				r.userSession = await getSessionInfoFromAPI(fylrEnv)
				r.userInfo = await getUserInfoFromAPI(fylrEnv, r.userSession.user.user._id)
				break

			case 'env':
				r = fylrEnv
				break

			case 'get-preset-blocklist':
				r = getPresetBlocklist(context)
				break

			case 'evaluate':
				r = await evaluate(context, inputBody)
				break

			// case 'test': {
			// 	const blocklist1 = getPresetBlocklist(context).split('\n').filter(line => line.trim().length > 0)
			// 	const blocklist2 = context.config.customBlocklist
			// 	const blocklist = [...blocklist1, ...blocklist2]
			// 	const {text} = inputBody
			// 	const stems = await stemmify(context, text)
			// 	r = 'OKAY'
			// 	for (const word of stems) {
			// 		if (_.contains(blocklist, word.toLowerCase())) {
			// 			r = 'BAD'
			// 		}
			// 	}
			// 	// r = await evaluate(context, inputBody)
			// } break

			case 'saving': {
				console.error('Citizen Archives: Check for analyzing entries')//, JSON.stringify(inputBody.objects))

				let doTagEntryForUser = false

				// check whether this user already has too many tagged entries and thus gets auto-tagged
				const userSession = await getSessionInfoFromAPI(fylrEnv)
				const userInfo = await getUserInfoFromAPI(fylrEnv, userSession.user.user._id)
				const alreadyTaggedCount = userInfo[0].user.custom_data.citizenarchives__already_tagged_count ?? 0
				if (alreadyTaggedCount >= context.config.flagRepeatOffendersAfterN) {
					doTagEntryForUser = true
				}

				// console.error("...checking repeat user, userId="+userInfo[0].user._id+", alreadyTaggedCount="+alreadyTaggedCount+", config max="+context.config.flagRepeatOffendersAfterN+", doTagEntryForUser="+(doTagEntryForUser? 'yes' : 'no'))

				// check 
				const allModelIdsToCheck = context.config.applyFields.map(entry => entry.model)
				const schema = await getCurrentSchemaFromAPI(fylrEnv)
				// const objects = TEST_OBJECTS
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
							console.error("...no match: Invalid check")
							continue
						}
						// no match for object type?
						if (check.model !== newObjectTableId) {
							console.error("...no match: Different object type")
							continue
						}
						// no match for trigger tag?
						if (check['trigger-tag']!==null && newObject._tags.map(tag => tag._id).indexOf(check['trigger-tag']) === -1) {
							console.error("...no match: Trigger tag not set on this entry")
							continue
						}
						let doTagEntry = doTagEntryForUser
						if ( ! doTagEntry) {
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
							// console.error('tableName=', tableName, 'columnName=', columnName)
							const textToCheck = newObject[tableName][columnName]

							const evaluation = await evaluate(context, {text: textToCheck})
							console.error('...evaluation: '+(evaluation.failed? 'FAILED' : 'PASSED'))
							if (evaluation.failed) {
								doTagEntry = true
							}
						}
						if (doTagEntry) {
							// newObject[tableName][columnName] += ' Teeeeeest appendum'
							// add marking tags
							// TODO: Make it work!
							const newTagId = check['marking-tag']
							newObject._tags.push({
								_id: newTagId
							})
							// increase tagged count for user
							await increaseUserAlreadyTaggedCount(fylrEnv)
						}
					}
				}
				// console.error("Already tagged", alreadyTaggedCount)
				// console.error()
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
})*/









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
