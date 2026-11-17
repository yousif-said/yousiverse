import { functions, inngest } from "@yousiverse/api/jobs";
import { serve } from "inngest/next";

// Inngest calls this address to run background jobs. In production it only answers requests
// signed with INNGEST_SIGNING_KEY.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
