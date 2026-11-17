export type ConversationDto = {
  id: string;
  otherName: string;
  jobTitle: string;
  lastPreview: string;
  lastAt: string;
  unread: number;
};

export type MessageDto = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  /** True while a message the user just sent is still being saved. */
  pending?: boolean;
  failed?: boolean;
};

export const MAX_MESSAGE = 4000;
