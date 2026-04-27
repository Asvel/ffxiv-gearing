// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as RMWC from '../types';
import React from 'react';
import type { MDCLinearProgressFoundation } from '../../@material/linear-progress';
import { useLinearProgressFoundation } from './foundation';
import { Tag, useClassNames, createComponent } from '../base';

/** A component to display linear progress. */
export interface LinearProgressProps {
  /** Progress float percentage between 0 and 1. */
  progress?: number;
  /** A Progress buffer float percentage between 0 and 1. */
  buffer?: number;
  /** Hides the progress bar. Adding / removing this prop will trigger an animation in or out.  */
  closed?: boolean;
  /** Advanced: A reference to the MDCFoundation. */
  foundationRef?: React.Ref<MDCLinearProgressFoundation>;
}

/** A component to display linear progress. */
export const LinearProgress = createComponent<LinearProgressProps>(
  function LinearProgress(props) {
    const { closed, progress, buffer, foundationRef, ...rest } = props;
    const className = useClassNames(props, [
      'mdc-linear-progress',
      {
        'mdc-linear-progress--indeterminate': progress === undefined,
        'mdc-linear-progress--closed': closed
      }
    ]);
    const { rootEl } = useLinearProgressFoundation(props);

    return (
      <Tag
        aria-label="Progress Bar"
        {...rest}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={progress}
        tag="div"
        role="progressbar"
        element={rootEl}
        className={className}
      >
        <LinearProgressBody />
      </Tag>
    );
  }
);

const LinearProgressBody = React.memo(function LinearProgressBody() {
  return (
    <>
      <div className="mdc-linear-progress__buffer">
        <div className="mdc-linear-progress__buffer-bar"></div>
        <div className="mdc-linear-progress__buffer-dots"></div>
      </div>
      <div className="mdc-linear-progress__bar mdc-linear-progress__primary-bar">
        <div className="mdc-linear-progress__bar-inner" />
      </div>
      <div className="mdc-linear-progress__bar mdc-linear-progress__secondary-bar">
        <div className="mdc-linear-progress__bar-inner" />
      </div>
    </>
  );
});
