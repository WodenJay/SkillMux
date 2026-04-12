#!/usr/bin/env node

import { buildCli } from "./index";

buildCli().parse(process.argv);
