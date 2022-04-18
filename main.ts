import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { promisify } from "util";
import { exec } from "child_process";

const exec_async = promisify(exec);

interface GitLightSettings {
	syncPeriodSeconds: number;
	vaultRootPath: string;
}

const DEFAULT_SETTINGS: GitLightSettings = {
	syncPeriodSeconds: 3600,
	vaultRootPath: ""
}

export default class GitLight extends Plugin {
	settings: GitLightSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'gitlight-sync',
			name: 'Sync',
			callback: async () => { await this.sync() }
		});

		this.addSettingTab(new GitLightSettingsTab(this.app, this));

		console.log(`[GitLight] Setting sync to ${this.settings.syncPeriodSeconds} seconds`)
		if (this.settings.syncPeriodSeconds > 0) {
			this.registerInterval(window.setInterval(async () => { await this.sync() }, this.settings.syncPeriodSeconds * 1000));
		}
		
		await this.sync()
	}
	
	async sync() {
		console.log("[GitLight] Starting sync.")
		const commands = [
			"git add -A",
			"git diff-index --quiet HEAD || git commit -m 'GitLight Sync'",
			"git pull",
			"git push"
		]
		
		for (const command of commands) {
			let stdout, stderr: string
			try {
				const result = await exec_async(command, { cwd: this.settings.vaultRootPath })
				stdout = result.stdout
				stderr = result.stderr
			} catch (Exception) {
				new Notice(`[GitLight] Sync failed: Command '${command}' failed.`, 3600 * 24 * 1000)
				console.log(`[GitLight] Sync failed: Command '${command}' failed.\nstdout: ${stdout}\nstderr: ${stderr}`)
				return false
			}
		}

		new Notice("[GitLight] Sync finished successfully.", 5 * 1000)
		console.log("[GitLight] Sync finished successfully.")
		return true
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class GitLightSettingsTab extends PluginSettingTab {
	plugin: GitLight;

	constructor(app: App, plugin: GitLight) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Synchronization period in seconds')
			.setDesc("Requires restarting Obsidian. Set to 0 to disable automatic synchronization.")
			.addText(text => text
				.setValue(String(this.plugin.settings.syncPeriodSeconds))
				.onChange(async (value) => {
					this.plugin.settings.syncPeriodSeconds = Number(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Absolute path to vault root directory.')
			.setDesc("E.g. '/home/user/obsidian'")
			.addText(text => text
				.setValue(this.plugin.settings.vaultRootPath)
				.onChange(async (value) => {
					this.plugin.settings.vaultRootPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
