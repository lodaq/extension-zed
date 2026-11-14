import "./savedPage"
import { installPlayback } from "../lib/playback"

void installPlayback().catch((error) => console.error("Zed playback initialization failed", error))
