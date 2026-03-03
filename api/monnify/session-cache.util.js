const v8 = require("v8")
const fs = require("fs")
const path = require("path")

const CACHE_DIR = path.join(__dirname, "..", "cache")
const CACHE_FILE = path.join(CACHE_DIR, "session_cache.bin")

if (!fs.existsSync(CACHE_DIR)) {
	fs.mkdirSync(CACHE_DIR)
}

class SessionCache {
	constructor() {
		this.cache = new Map()
		this.loadCacheFromFile()
	}

	loadCacheFromFile() {
		if (fs.existsSync(CACHE_FILE)) {
			const data = fs.readFileSync(CACHE_FILE)
			this.cache = v8.deserialize(data)
		}
	}

	saveCacheToFile() {
		const data = v8.serialize(this.cache)
		fs.writeFileSync(CACHE_FILE, data)
	}

	get(key) {
		return this.cache.get(key)
	}

	set(key, value) {
		this.cache.set(key, value)
		this.saveCacheToFile()
	}

	delete(key) {
		this.cache.delete(key)
		this.saveCacheToFile()
	}

	clear() {
		this.cache.clear()
		this.saveCacheToFile()
	}
}

module.exports = new SessionCache()
