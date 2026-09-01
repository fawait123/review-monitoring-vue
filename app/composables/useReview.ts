import type { PR, Review, ReviewComment } from "~~/shared/types";
import { useReviewState } from "./useReviewState";
import { useReviewRun } from "./useReviewRun";
import { useReviewComments } from "./useReviewComments";
import { useReviewSubmit } from "./useReviewSubmit";

export type ReviewMode = "idle" | "running" | "editing" | "submitted";

export interface LogLine {
  kind: "info" | "tool" | "text" | "console";
  text: string;
}

export function useReview(options: {
  pr: PR;
  reviews: Review[];
  commentsByReview: Record<number, ReviewComment[]>;
  onSubmitted?: () => void;
}) {
  const state = useReviewState(options);
  const run = useReviewRun({
    pr: options.pr,
    mode: state.mode,
    activeReviewId: state.activeReviewId,
    summary: state.summary,
    comments: state.comments,
    log: state.log,
    excludedPaths: state.excludedPaths,
    abortRef: state.abortRef,
    pushLog: state.pushLog,
  });
  const commentsApi = useReviewComments({
    activeReviewId: state.activeReviewId,
    comments: state.comments,
    editingId: state.editingId,
    editBody: state.editBody,
    openThread: state.openThread,
  });
  const submitApi = useReviewSubmit({
    activeReviewId: state.activeReviewId,
    summary: state.summary,
    mode: state.mode,
    submitting: state.submitting,
    onSubmitted: options.onSubmitted,
  });

  return {
    mode: state.mode,
    activeReviewId: state.activeReviewId,
    summary: state.summary,
    comments: state.comments,
    log: state.log,
    editingId: state.editingId,
    editBody: state.editBody,
    openThread: state.openThread,
    submitting: state.submitting,
    excludedPaths: state.excludedPaths,
    totalExclude: state.totalExclude,
    toggleExclude: state.toggleExclude,
    runReview: run.runReview,
    cancelRun: run.cancelRun,
    loadReview: run.loadReview,
    addComment: commentsApi.addComment,
    startEditComment: commentsApi.startEditComment,
    cancelEditComment: commentsApi.cancelEditComment,
    saveEdit: commentsApi.saveEdit,
    removeComment: commentsApi.removeComment,
    saveSummary: submitApi.saveSummary,
    submit: submitApi.submit,
  };
}
