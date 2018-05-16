'use strict';

const distance = require('haversine-distance');
const moment = require('moment');
const _ = require('lodash');

const default_options = {
  near_threshold_m: 100
};

class MovesCleaner {

  constructor(options) {
    this.options = _.defaults({}, options, default_options);
  }

  close_gaps(segments) {

    return MovesCleaner._map_segments(segments, (current_segment, previous_segment, next_segment) => {

      if (current_segment.type !== 'place')
        return current_segment;

      if (previous_segment) {
        const previous_end = _.last(MovesCleaner._locations_of_segment(previous_segment));
        const current_start = _.first(MovesCleaner._locations_of_segment(current_segment));

        if (MovesCleaner._is_location_near(current_start, previous_end, this.options.near_threshold_m))
          current_segment = _.merge({}, current_segment, { startTime: previous_segment.endTime });
      }

      if (next_segment) {
        const current_end= _.last(MovesCleaner._locations_of_segment(current_segment));
        const next_start = _.first(MovesCleaner._locations_of_segment(next_segment));

        if (MovesCleaner._is_location_near(current_end, next_start, this.options.near_threshold_m))
          current_segment = _.merge({}, current_segment, { endTime: next_segment.startTime });
      }

      return current_segment;
    });
  }

  filter_off_segments(segments) {
    return _.filter(segments, segment => segment.type !== 'off');
  }

  flatten_move_segments(segments) {
    return _.chain(segments)
      .flatMap(segment => {

        if (segment.type === 'move' && segment.activities) {
          return _.map(segment.activities, activity => {
            return _.defaults(activity, {
              type: 'move',
              startTime: segment.startTime,
              endTime: segment.endTime
            });
          });
        } else {
          return segment;
        }

      })
      .filter()
      .uniqBy(segment => `${segment.type} ${moment(segment.startTime).unix()} ${moment(segment.endTime).unix()}`)
      .value();
  }

  merge_move_segments(segments) {
    return this._merge_segments(segments, MovesCleaner._is_same_move, (a, b) => {

      const merged_trackPoints = _(a.trackPoints || [])
        .concat(b.trackPoints || [])
        .sortBy('time')
        .value();

      return _.assign({}, a, {
        endTime: b.endTime,
        duration: moment(b.endTime).diff(a.startTime, 'second'),
        distance: MovesCleaner._path_distance(merged_trackPoints),
        trackPoints: merged_trackPoints
      });
    });
  }

  merge_place_segments(segments) {
    return this._merge_segments(segments, MovesCleaner._is_same_place, (a, b) => {

      const merged_activities = _(a.activities || [])
        .concat(b.activities || [])
        .uniqWith(MovesCleaner._is_same_segment)
        .value();

      return _.assign({}, a, {
        endTime: b.endTime,
        activities: merged_activities
      });
    });
  }

  apply(segments) {

    const process_flow = _.flow([
      this.flatten_move_segments,
      this.sort_segments,
      this.merge_move_segments,
      this.merge_place_segments,
      this.close_gaps,
      this.filter_off_segments,
    ]);

    return _.bind(process_flow, this)(segments);
  }

  sort_segments(segments) {
    return _.sortBy(segments, segment => moment(segment.startTime).unix());
  }

  static _is_location_near(a, b, threshold_m) {
    if (a == null || b == null)
      return false;

    return  distance(a, b) < threshold_m;
  }

  static _is_same_move(a, b) {
    if( a.type === 'move' && b.type === 'move') {
      return a.activity === b.activity;
    } else {
      return false;
    }
  }

  static _is_same_place(a, b) {
    if( a.type === 'place' && b.type === 'place') {
      return a.place.id === b.place.id;
    } else {
      return false;
    }
  }

  static _is_same_segment(a, b) {
    return a.type === b.type &&
      moment(a.startTime).isSame(b.startTime) && moment(a.endTime).isSame(b.endTime);
  }

  static _map_segments(segments, iteree) {
    let prev = null;
    return _.map(segments, (segment, index) => {
      let next = null;
      if (index + 1 < segments.length - 1)
        next = segments[index + 1];

      return prev = iteree(segment, prev, next);
    });
  }

  static _locations_of_segment(segment) {
    if (segment.type === 'place')
      return [segment.place.location];
    else
      return _.map(segment.trackPoints, s => _.omit(s, 'time'));
  }

  static _path_distance(points) {
    const sum = _.reduce(points, (sum, point, i) => {
      if (i + 1 < points.length - 1) {
        return sum + distance(point, points[i + 1]);
      } else {
        return sum;
      }
    }, 0);

    return Math.round(sum);
  }

  _merge_segments(segments, comparator, merger) {

    const merged_segments = [];

    let end = 1;
    for (let start = 0; start < segments.length; start = end) {

      const start_segment = segments[start];
      for (end = start + 1; end < segments.length; end++) {
        const end_segment = segments[end];
        if (!comparator(start_segment, end_segment))
          break;
      }

      let merged_segment = start_segment;
      for (let i = start + 1; i < end; i++) {
        merged_segment = merger(merged_segment, segments[i]);
      }
      merged_segments.push(merged_segment);
    }

    return merged_segments;
  }

}

module.exports = MovesCleaner;