
import * as pug from "../commonjs/pug.js"
import {read} from "authoritarian/dist/toolbox/reading.js"

export const getTemplate = async(path: string) => pug.compile(await read(path))
