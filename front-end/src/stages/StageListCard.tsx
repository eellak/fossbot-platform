// Stage collections reuse the shared list card so stages, courses, and the
// editor stage picker all read the same. Kept as a stage-named entry point for
// existing imports.
export {
  ListCard as StageListCard,
  ListCardSkeleton as StageListCardSkeleton,
  type ListCardProps as StageListCardProps,
} from 'src/components/shared/ListCard';
export { default } from 'src/components/shared/ListCard';
