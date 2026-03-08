import { DefineAuthChallengeTriggerEvent } from 'aws-lambda';

export const handler = async (
  event: DefineAuthChallengeTriggerEvent
): Promise<DefineAuthChallengeTriggerEvent> => {
  const { session } = event.request;

  if (
    session.length > 0 &&
    session[session.length - 1].challengeResult === true
  ) {
    // The user has successfully answered the challenge — issue tokens
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else if (session.length >= 3) {
    // Too many failed attempts — fail authentication
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else {
    // Issue a new CUSTOM_CHALLENGE
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  }

  return event;
};
