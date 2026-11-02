import {
  answersList,
  opinionsList,
  linkCreate,
  linkList,
  linkResend,
  qrDisplay,
  questionsCreate,
  questionsDelete,
  questionsList,
  questionsUpdate,
  subscribersCount,
  subscribersInvite,
  type Options,
} from './generated/index.js';

/** Project-scoped operations with concise, discoverable resource groups. */
export const questions = {
  list: questionsList,
  create: questionsCreate,
  update: questionsUpdate,
  delete: questionsDelete,
} as const;

export const link = {
  list: linkList,
  create: linkCreate,
  resend: linkResend,
} as const;

export const qr = {
  display: qrDisplay,
} as const;

export const opinions = {
  list: opinionsList,
} as const;

export const answers = {
  list: answersList,
} as const;

export const subscribers = {
  count: subscribersCount,
  invite: subscribersInvite,
} as const;

/**
 * Creates a project-scoped facade that injects `projectId` into each operation.
 * This is a plain factory and does not require React.
 */
export function useProject(projectId: string) {
  return {
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
    link: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof linkList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => linkList({ ...parameters, projectId }, options),
      create: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof linkCreate>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => linkCreate({ ...parameters, projectId }, options),
      resend: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof linkResend>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => linkResend({ ...parameters, projectId }, options),
    },
    qr: {
      display: <ThrowOnError extends boolean = false>(options?: Options<never, ThrowOnError>) =>
        qrDisplay({ projectId }, options),
    },
    opinions: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof opinionsList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => opinionsList({ ...parameters, projectId }, options),
    },
    answers: {
      list: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof answersList>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => answersList({ ...parameters, projectId }, options),
    },
    subscribers: {
      count: <ThrowOnError extends boolean = false>(options?: Options<never, ThrowOnError>) =>
        subscribersCount({ projectId }, options),
      invite: <ThrowOnError extends boolean = false>(
        parameters: Omit<Parameters<typeof subscribersInvite>[0], 'projectId'>,
        options?: Options<never, ThrowOnError>,
      ) => subscribersInvite({ ...parameters, projectId }, options),
    },
  } as const;
}

/** @deprecated Prefer the top-level resource groups in new code. */
export const project = {
  questions,
  link,
  qr,
  opinions,
  answers,
  subscribers,
} as const;
