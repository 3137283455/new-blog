import db from "../../../config/database";
import { SourceStore } from "./source-store";

export const sourceStore = new SourceStore(db);
