import nock from 'nock';

// Tests must never reach a real host, least of all the Jobs API, which bills real minutes:
nock.disableNetConnect();
