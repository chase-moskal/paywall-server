
import mod from "module"
const require = mod.createRequire(import.meta.url)
import * as _mongodb from "mongodb"
export * from "mongodb"
const mongodb = require("mongodb") as typeof _mongodb

const {
	ObjectId,
	MongoClient,
} = mongodb

export {
	ObjectId,
	MongoClient,
}
