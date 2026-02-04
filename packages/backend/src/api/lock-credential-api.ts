import type {
  LockCredential,
  LockCredentialRequest,
  LockCredentialsResponse,
} from "@home-assistant-matter-hub/common";
import { type Request, type Response, Router } from "express";
import type { LockCredentialStorage } from "../services/storage/lock-credential-storage.js";

export function lockCredentialApi(
  lockCredentialStorage: LockCredentialStorage,
): Router {
  const router = Router();

  // Get all lock credentials
  router.get(
    "/",
    async (_req: Request, res: Response<LockCredentialsResponse>) => {
      const credentials = lockCredentialStorage.getAllCredentials();
      // Don't expose actual PIN codes in the list response for security
      const sanitizedCredentials = credentials.map((c) => ({
        ...c,
        pinCode: "****", // Mask the PIN
      }));
      res.json({ credentials: sanitizedCredentials });
    },
  );

  // Get a specific lock credential
  router.get(
    "/:entityId",
    async (
      req: Request<{ entityId: string }>,
      res: Response<LockCredential | { error: string }>,
    ) => {
      const { entityId } = req.params;
      const decodedEntityId = decodeURIComponent(entityId);
      const credential = lockCredentialStorage.getCredential(decodedEntityId);

      if (!credential) {
        res.status(404).json({ error: "Credential not found" });
        return;
      }

      // Don't expose actual PIN code
      res.json({ ...credential, pinCode: "****" });
    },
  );

  // Create or update a lock credential
  router.put(
    "/:entityId",
    async (
      req: Request<{ entityId: string }, unknown, LockCredentialRequest>,
      res: Response<LockCredential | { error: string }>,
    ) => {
      const { entityId } = req.params;
      const decodedEntityId = decodeURIComponent(entityId);
      const { pinCode, name, enabled } = req.body;

      if (!pinCode || pinCode.length < 4 || pinCode.length > 8) {
        res
          .status(400)
          .json({ error: "PIN code must be between 4 and 8 digits" });
        return;
      }

      if (!/^\d+$/.test(pinCode)) {
        res.status(400).json({ error: "PIN code must contain only digits" });
        return;
      }

      const credential = await lockCredentialStorage.setCredential({
        entityId: decodedEntityId,
        pinCode,
        name,
        enabled,
      });

      // Don't expose actual PIN code in response
      res.json({ ...credential, pinCode: "****" });
    },
  );

  // Delete a lock credential
  router.delete(
    "/:entityId",
    async (
      req: Request<{ entityId: string }>,
      res: Response<{ success: boolean }>,
    ) => {
      const { entityId } = req.params;
      const decodedEntityId = decodeURIComponent(entityId);
      await lockCredentialStorage.deleteCredential(decodedEntityId);
      res.json({ success: true });
    },
  );

  return router;
}
