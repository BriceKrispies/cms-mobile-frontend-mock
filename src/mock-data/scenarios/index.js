import { defaultScenario } from './default.js';
import { emptyScenario } from './empty.js';
import { heavyScenario } from './heavy.js';

export const scenarios = {
  default: defaultScenario,
  empty:   emptyScenario,
  heavy:   heavyScenario,
};

export const scenarioList = Object.values(scenarios);
