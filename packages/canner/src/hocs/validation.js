// @flow

import * as React from 'react';
import RefId from 'canner-ref-id';
import Ajv from 'ajv';
import {isEmpty, isArray, isPlainObject, get} from 'lodash';
import type {HOCProps} from './types';

type State = {
  error: boolean,
  errorInfo: Array<any>
}

export default function withValidation(Com: React.ComponentType<*>) {
  return class ComponentWithValition extends React.Component<HOCProps, State> {
    key: string;
    id: ?string;
    callbackId: ?string;
    state = {
      error: false,
      errorInfo: []
    }

    componentDidMount() {
      const {refId, validation = {}, onDeploy, required = false} = this.props;
      const key = refId.getPathArr()[0];
      const ajv = new Ajv();
      const validate = ajv.compile(validation);
      if (isEmpty(validation) && !required) {
        // no validation
        return;
      }
      let paths = refId.getPathArr();
      const {validator} = validation;
      paths = paths.slice(1);
      const reject = message => ({error: true, message});
      this.callbackId = onDeploy(key, result => {
        const {value} = getValueAndPaths(result.data, paths);
        const isRequiredValid = required ? Boolean(value) : true;
        const validatorResult = validator && validator(value, reject);
        let customValid = true;
        if (validatorResult && validatorResult.error) {
          customValid = false;
        }
        if (customValid && isRequiredValid && validate(value)) {
          this.setState({
            error: false,
            errorInfo: []
          });
          return result;
        }
        const errorInfo = [].concat(isRequiredValid ? [] : {
          message: 'should be required'
        }).concat(validate.errors || [])
          .concat(customValid ? [] : validatorResult);
        this.setState({
          error: true,
          errorInfo: errorInfo
        });
        return {
          ...result,
          error: true,
          errorInfo: errorInfo
        }
      });
    }

    componentWillUnmount() {
      this.removeOnDeploy();
    }

    removeOnDeploy = () => {
      const {refId, removeOnDeploy} = this.props;
      if (this.callbackId) {
        removeOnDeploy(refId.getPathArr()[0], this.callbackId || '');
      }
    }

    render() {
      const {error, errorInfo} = this.state;
      return <React.Fragment>
        <Com {...this.props}/>
        {
          error && <span style={{color: 'red'}}>{errorInfo[0].message}</span>
        }
      </React.Fragment>
  }
  };
}

export function splitRefId({
  refId,
  rootValue,
  pattern
}: {
  refId: RefId,
  rootValue: any,
  pattern: string
}) {
  const [key, index] = refId.getPathArr();
  let id;
  if (pattern.startsWith('array')) {
    id = get(rootValue, [key, index, 'id']);
  }
  return {
    key,
    id
  }
}

export function getValueAndPaths(value: Object, idPathArr: Array<string>) {
  return idPathArr.reduce((result: any, key: string) => {
    let v = result.value;
    let paths = result.paths;
    if (isPlainObject(v)) {
      if ('edges' in v && 'pageInfo' in v) {
        v = get(v, ['edges', key, 'node']);
        paths = paths.concat(['edges', key, 'node']);
      } else {
        v = v[key];
        paths = paths.concat(key);
      }
    } else if (isArray(v)) {
      v = v[key];
      paths = paths.concat(key);
    }
    return {
      value: v,
      paths
    }
  }, {
    value,
    paths: []
  });
}