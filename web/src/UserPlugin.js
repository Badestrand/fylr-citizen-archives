// More or less copied from https://github.com/programmfabrik/easydb-example-plugin/blob/master/src/webfrontend/ExampleUserPlugin.coffee

/*class CitizenArchivesUserPlugin extends ez5.UserPlugin {
	getTabs(tabs) {
		tabs.push({
			name: "citizenarchives-userplugin",
			text: "Citizen Archives User Plugin",
			content: () => {
				const form = new CUI.Form({
					data: this._user.data.user,
					name: "citizen_archives_userdata",
					fields: [
						{
							type: CUI.Input,
							name: "already_tagged_count",
							form: {
								label: "Anzahl schon getaggter Beiträge",
								hint: "Auf 0 zurücksetzen, um dem Nutzer wieder eine weiße Weste zu geben. Auf 1000 setzen, um alle zukünftigen Beiträge des Nutzers automatisch zu taggen."
							}
						}
					]
				})
				return form.start()
			}
		})
	}

	getSaveData(saveData) {
		saveData.user.custom_data.my_field = this._user.data.user.custom_data.my_field
	}

	isAllowed() {
		return true
		// return this._user.data.user.type in ["easydb", "system"]
	}
}


ez5.User.plugins.registerPlugin(CitizenArchivesUserPlugin)
*/


var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	hasProp = {}.hasOwnProperty;



ez5.CitizenArchivesUserPlugin = (function(superClass) {
	extend(CitizenArchivesUserPlugin, superClass)

	function CitizenArchivesUserPlugin() {
		return CitizenArchivesUserPlugin.__super__.constructor.apply(this, arguments)
	}

	CitizenArchivesUserPlugin.prototype.getTabs = function(tabs) {
		tabs.push({
			name: "citizenarchives_userplugin",
			text: $$("citizenarchives.user.plugin.tab-text"),
			content: (function(_this) {
				return function() {
					const form = new CUI.Form({
						data: _this._user.data.user,
						name: "custom_data",
						fields: [{
							type: CUI.NumberInput,
							min: 0,
							max: 1000,
							name: "citizenarchives__already_tagged_count",
							form: {
								label: $$("citizenarchives.user.plugin.form.id.label"),
								hint: $$("citizenarchives.user.plugin.form.id.hint.md")
							},
						}]
					})
					return form.start()
				}
			})(this)
		})
		return tabs
	}

	CitizenArchivesUserPlugin.prototype.getSaveData = function(saveData) {
		saveData.user.custom_data.citizenarchives__already_tagged_count = this._user.data.user.custom_data.citizenarchives__already_tagged_count;
	}

	CitizenArchivesUserPlugin.prototype.isAllowed = function() {
		return true
	}

	return CitizenArchivesUserPlugin
})(ez5.UserPlugin)



User.plugins.registerPlugin(ez5.CitizenArchivesUserPlugin)
