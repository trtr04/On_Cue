import womenCorpus from "../女性职场PUA话术.md?raw";
import familyCorpus from "../家庭PUA话术.md?raw";
import workplaceCorpus from "../职场PUA话术集合.md?raw";
import { buildTrainingKnowledge } from "./training-knowledge.js";

export const trainingKnowledge = buildTrainingKnowledge({
  "女性职场PUA话术.md": womenCorpus,
  "家庭PUA话术.md": familyCorpus,
  "职场PUA话术集合.md": workplaceCorpus,
});
