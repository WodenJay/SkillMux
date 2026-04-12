#!/usr/bin/env node

import { buildCli } from "./index";

await buildCli().parseAsync(process.argv);
