
# Moves App Segment Cleaner

Having worked with data from the [Moves App](https://www.moves-app.com) —both from the API as well as manual JSON exports — I've noticed a few
recurring oddities I attempt to correct with this utility. Namely:

 * Long stays at a single location (in excess of 24 hours) tend to get truncated, forming a time gap
 * Occasionally a single stay or single move will get chopped into multiple segments
 * Other time gaps inexplicably appear between segments, absent an 'off' segment
 * Not specifically a problem, but multple consecutive movements (e.g. walking → transport → walking) are merged as activities under a single 'move' segment. I prefer these separated into separate segments to simplify analysis.

## Installation

```bash
npm install --save @claygregory/moves-cleaner
```

## Usage

 For most applications, just call the single `apply` method on an array of segments.

 ```javascript
const MovesCleaner = require('@claygregory/moves-cleaner');

const movesCleaner = new MovesCleaner();
const normalizedSegments = movesCleaner.apply([
  { type: 'move', activities: […], … },
  { type: 'place', activities: […], … },
  …
]);
 ```

### Additional Methods

Individual normalization steps can be applied individually, which are typically applied in succession via `apply`. These include:

#### Close Gaps

Collapses the gap between two segments so long as no `off` segments are logged and the distance between the shoulder segments is within
a given threshold.

```javascript
movesCleaner.close_gaps([…]);
```

#### Filter Off Segments

Removes segments with a `type` value of `off`. The gaps in time remain, only the segments are removed.

```javascript
movesCleaner.filter_off_segments([…]);
```

#### Flatten Move Segments

Bubbles the individual activities of `move` segments up as standalone move segments.

```javascript
movesCleaner.flatten_move_segments([…]);
```

#### Merge Move Segments

Merges consecutive move segments of same type into a single segment. Track points are merged and start/end time, duration, and distance are corrected.

```javascript
movesCleaner.merge_move_segments([…]);
```

#### Merge Place Segments

Merges consecutive place segments with same place ID into a single segment. Start/end times are corrected.

```javascript
movesCleaner.merge_place_segments([…]);
```

#### Sort

Orders segments according to time. Many of the above methods assume time-ordered segments are provided.

```javascript
movesCleaner.sort_segments([…]);
```

### Options

 Currently only one configuration option is available: `near_threshold_m` is used in gap detection to determine when the end of one segment is close enough to the beginning of next. Gaps are only closed between if endpoints are within threshold. The default is 100 meters.

 ```javascript
const MovesCleaner = require('@claygregory/moves-cleaner');

const movesCleaner = new MovesCleaner({
  near_threshold_m: 250
});
 ```

## License

See the included [LICENSE](LICENSE.md) for rights and limitations under the terms of the MIT license.