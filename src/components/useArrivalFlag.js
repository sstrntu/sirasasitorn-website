import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * A one-time flag passed in route state, e.g.
 * `navigate('/', { state: { fromDesktop: true } })`, telling a page how it
 * was entered so it can play the matching transition.
 *
 * Read once on arrival, then cleared from the history entry: browsers keep
 * history state across a reload, so refreshing the page would otherwise play
 * the arrival transition again.
 */
const useArrivalFlag = (name) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [arrived] = useState(() => location.state?.[name] === true);

  useEffect(() => {
    if (location.state?.[name] !== true) return;
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true });
  }, [location, name, navigate]);

  return arrived;
};

export default useArrivalFlag;
