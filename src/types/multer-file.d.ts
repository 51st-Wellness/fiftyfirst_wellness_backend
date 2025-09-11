import { MulterFile as MulterFile_ } from "src/types";

// Global augmentation: make MulterFile available everywhere
declare global {
  interface MulterFile extends MulterFile_ {}
}

export {};