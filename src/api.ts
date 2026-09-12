import {
  answersList,
  goalsCreate,
  goalsDelete,
  goalsList,
  goalsUpdate,
  kbAddItem,
  kbDeleteItem,
  kbGet,
  kbUpdateItem,
  opinionsList,
  opinionsRespond,
  platformGoalsGet,
  platformGoalsUpdate,
  preverificationCreateLink,
  preverificationList,
  questionsCreate,
  questionsDelete,
  questionsList,
  questionsUpdate,
  subscribersBlock,
  subscribersList,
  type Options,
  webhooksPortal,
  webhooksUpsertDestination,
} from './generated/index.js';

/** Project-scoped operations with concise, discoverable resource groups. */
export const goals = {
  list: goalsList,
  create: goalsCreate,
  update: goalsUpdate,
  delete: goalsDelete,
} as const;

export const questions = {
  list: questionsList,
  create: questionsCreate,
  update: questionsUpdate,
  delete: questionsDelete,
} as const;

export const platformGoals = {
  get: platformGoalsGet,
  update: platformGoalsUpdate,
} as const;

export const preverifiedLinks = {
  list: preverificationList,
  create: preverificationCreateLink,
} as const;

export const opinions = {
  list: opinionsList,
  respond: opinionsRespond,
} as const;

export const answers = {
  list: answersList,
} as const;

export const subscribers = {
  list: subscribersList,
  block: subscribersBlock,
} as const;

/**
 * Creates a project-scoped facade that injects `projectId` into each operation.
 * This is a plain factory and does not require React.
 */
export function useProject(projectId: string) {
  return {
    goals: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof goalsList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => goalsList({ ...parameters, projectId }, options),
      create: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof goalsCreate>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => goalsCreate({ ...parameters, projectId }, options),
      update: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof goalsUpdate>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => goalsUpdate({ ...parameters, projectId }, options),
      delete: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof goalsDelete>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => goalsDelete({ ...parameters, projectId }, options),
    },
    questions: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof questionsList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => questionsList({ ...parameters, projectId }, options),
      create: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof questionsCreate>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => questionsCreate({ ...parameters, projectId }, options),
      update: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof questionsUpdate>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => questionsUpdate({ ...parameters, projectId }, options),
      delete: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof questionsDelete>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => questionsDelete({ ...parameters, projectId }, options),
    },
    platformGoals: {
      get: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof platformGoalsGet>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => platformGoalsGet({ ...parameters, projectId }, options),
      update: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof platformGoalsUpdate>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => platformGoalsUpdate({ ...parameters, projectId }, options),
    },
    preverifiedLinks: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof preverificationList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => preverificationList({ ...parameters, projectId }, options),
      create: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof preverificationCreateLink>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => preverificationCreateLink({ ...parameters, projectId }, options),
    },
    opinions: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof opinionsList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => opinionsList({ ...parameters, projectId }, options),
      respond: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof opinionsRespond>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => opinionsRespond({ ...parameters, projectId }, options),
    },
    answers: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof answersList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => answersList({ ...parameters, projectId }, options),
    },
    subscribers: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof subscribersList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => subscribersList({ ...parameters, projectId }, options),
      block: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof subscribersBlock>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => subscribersBlock({ ...parameters, projectId }, options),
    },
  } as const;
}

/** @deprecated Prefer the top-level resource groups in new code. */
export const project = {
  goals,
  questions,
  platformGoals,
  preverifiedLinks,
  opinions,
  answers,
  subscribers,
} as const;

/** Organization knowledge-base operations. */
export const knowledgeBase = {
  get: kbGet,
  add: kbAddItem,
  update: kbUpdateItem,
  delete: kbDeleteItem,
} as const;

/** Webhook configuration operations. */
export const webhooks = {
  portal: webhooksPortal,
  destinations: {
    upsert: webhooksUpsertDestination,
  },
} as const;
