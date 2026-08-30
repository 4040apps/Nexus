export type IntentHandoff = {
  goalId: string;
  sourceProviderId: string;
  authorizedByUser: true;
  constraints: {
    city: string;
    deadline: string;
    remainingBudget: number;
    currency: 'MXN';
  };
  remainingRequirements: Array<{
    id: string;
    type: string;
    quantity?: number;
  }>;
};

export function defineIntentHandoff(handoff: IntentHandoff): IntentHandoff {
  return handoff;
}
