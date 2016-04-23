import React, { Component, PropTypes } from 'react';
import s from './GroupsList.scss';
import Group from '../Group/Group';
import withStyles from '../../decorators/withStyles';

@withStyles(s)
class GroupsList extends Component {
  static propTypes = {
    groups: PropTypes.array.isRequired,
    onLightLoaded: PropTypes.func.isRequired,
    onEdit: PropTypes.func.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {};
  }

  render() {
    return (
      <ul className={s.groupList}>
        {this.props.groups.map((group) => {
          return (
            <Group key={group.id} {...group}
              onLightLoaded={this.props.onLightLoaded}
              onEdit={this.props.onEdit}
            />
          );
        })}
      </ul>
    );
  }
}

export default GroupsList;
