// More or less copied from https://github.com/programmfabrik/easydb-example-plugin/blob/master/src/webfrontend/ExampleUserPlugin.coffee



ez5.CitizenArchivesUserPlugin = (function(superClass) {
	const extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; }, hasProp = {}.hasOwnProperty;

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
						}, {
							type: CUI.Input,
							name: "citizenarchives__submitted_day_crnt",
							form: {
								label: $$("citizenarchives.user.plugin.form.sday.label"),
								hint: $$("citizenarchives.user.plugin.form.hint.dontchange")
							},
						}, {
							type: CUI.NumberInput,
							min: 0,
							max: 10000,
							name: "citizenarchives__submitted_day",
							form: {
								label: $$("citizenarchives.user.plugin.form.nday.label"),
								hint: $$("citizenarchives.user.plugin.form.hint.dontchange")
							},
						}, {
							type: CUI.Input,
							name: "citizenarchives__submitted_hour_crnt",
							form: {
								label: $$("citizenarchives.user.plugin.form.shour.label"),
								hint: $$("citizenarchives.user.plugin.form.hint.dontchange")
							},
						}, {
							type: CUI.NumberInput,
							min: 0,
							max: 10000,
							name: "citizenarchives__submitted_hour",
							form: {
								label: $$("citizenarchives.user.plugin.form.nhour.label"),
								hint: $$("citizenarchives.user.plugin.form.hint.dontchange")
							},
						}, {
							type: CUI.Input,
							name: "citizenarchives__submitted_minute_crnt",
							form: {
								label: $$("citizenarchives.user.plugin.form.sminute.label"),
								hint: $$("citizenarchives.user.plugin.form.hint.dontchange")
							},
						}, {
							type: CUI.NumberInput,
							min: 0,
							max: 10000,
							name: "citizenarchives__submitted_minute",
							form: {
								label: $$("citizenarchives.user.plugin.form.nminute.label"),
								hint: $$("citizenarchives.user.plugin.form.hint.dontchange")
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
		saveData.user.custom_data.citizenarchives__submitted_day_crnt = this._user.data.user.custom_data.citizenarchives__submitted_day_crnt;
		saveData.user.custom_data.citizenarchives__submitted_day = this._user.data.user.custom_data.citizenarchives__submitted_day;
		saveData.user.custom_data.citizenarchives__submitted_hour_crnt = this._user.data.user.custom_data.citizenarchives__submitted_hour_crnt;
		saveData.user.custom_data.citizenarchives__submitted_hour = this._user.data.user.custom_data.citizenarchives__submitted_hour;
		saveData.user.custom_data.citizenarchives__submitted_minute_crnt = this._user.data.user.custom_data.citizenarchives__submitted_minute_crnt;
		saveData.user.custom_data.citizenarchives__submitted_minute = this._user.data.user.custom_data.citizenarchives__submitted_minute;
	}

	CitizenArchivesUserPlugin.prototype.isAllowed = function() {
		return true
	}

	return CitizenArchivesUserPlugin
})(ez5.UserPlugin)



User.plugins.registerPlugin(ez5.CitizenArchivesUserPlugin)
