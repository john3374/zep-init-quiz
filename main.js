const STATE_INIT = 3000;
const STATE_READY = 3001;
const STATE_PLAYING = 3002;
const STATE_JUDGE = 3004;
const STATE_END = 3005;
const STATE_CHOOSE_CATEGORY = 3006;

const CATEGORIES = ["포유류", "조류", "파충류"];
const WORD_LINES = [
  "너구리 두더지 코알라 캥거루 웜벳 개미핥기 하늘다람쥐 늑대 사자 호랑이 사슴 소 돼지 말 쥐 고양이 강아지 코끼리 원숭이 고래 박쥐 여우 다람쥐 낙타 햄스터",
  "참새 까마귀 까치 타조 병아리 꿩 공작 오리 거위 비둘기 앵무새",
  "자라 거북이 도마뱀 뱀 악어",
];

let WORDS = {};

let _state = STATE_CHOOSE_CATEGORY;
let _stateTimer = 0;
let _timer = 0,
  _time = 60;
let _choanswer = "";
let _answer = "";
let _start = false;
let _widget = null; // using for contents UI
let _players = null;
let _result = "";
let _category = "";
let _gameID = "";
let _round = 0;
let _roundNum = 0;
const { spaceHashID, mapHashID, creatorID, appHashID } = App;

for (let i = 0, il = CATEGORIES.length; i < il; i++) WORDS[CATEGORIES[i]] = WORD_LINES[i].trim().split(" ");

function cho_hangul(str) {
  cho = [
    "ㄱ",
    "ㄲ",
    "ㄴ",
    "ㄷ",
    "ㄸ",
    "ㄹ",
    "ㅁ",
    "ㅂ",
    "ㅃ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅉ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
  ];
  result = "";
  for (let i = 0; i < str.length; ++i) {
    code = str.charCodeAt(i) - 44032;
    if (code > -1 && code < 11172) result += cho[Math.floor(code / 588)];
    else result += str.charAt(i);
  }
  return result;
}

App.onStart.Add(function () {
  startState(STATE_CHOOSE_CATEGORY);
});

// when chatting event
// 채팅을 치면 호출되는 이벤트
// player : person who chatted
// text : chat text
// return : enter chatting box
// return false or true : not appear in chatting box
App.onSay.add(function (player, text) {
  if (_state == STATE_PLAYING) {
    if (_answer == text) {
      _result = player.name + "님 정답!\n정답은 " + _answer;
      try {
        App.httpPostJson(
          `https://zep-chosung.xn--vf4b.com/game/${_gameID}/round/${_roundNum - 1}/winner`,
          { Authorization: `Bearer ${player.tag.auth}` },
          { playerID: player.id },
          () => {}
        );
      } catch (e) {
        _players.sendMessage(e);
      }
      startState(STATE_JUDGE);
    }
  }
});

function startState(state) {
  _state = state;
  _stateTimer = 0;

  switch (_state) {
    case STATE_INIT:
      if (_widget) {
        _widget.destroy();
        _widget = null;
      }
      if (!_category) {
        App.showCenterLabel("주제가 정해지지 않아 게임을 종료합니다.", 0xffffff, 0x000000, 115);
        startState(STATE_END);
        return;
      }
      try {
        App.httpPostJson(
          "https://zep-chosung.xn--vf4b.com/game",
          {},
          { spaceHashID, mapHashID, creatorID, appHashID, category: _category, time: _time, rounds: _round },
          gameID => {
            _gameID = gameID;
            startState(STATE_READY);
          }
        );
      } catch (e) {
        _players.sendMessage(e);
      }
      break;
    case STATE_READY:
      _start = true;
      _answer = WORDS[_category][Math.floor(Math.random() * WORDS[_category].length)];
      _timer = _time;
      _choanswer = cho_hangul(_answer);
      try {
        App.httpPostJson(
          `https://zep-chosung.xn--vf4b.com/game/${_gameID}/round`,
          { Authorization: `Bearer ${_players.tag.auth}` },
          { round: _roundNum++, answer: _answer },
          () => _round--
        );
      } catch (e) {
        _players.sendMessage(e);
      }
      startState(STATE_PLAYING);
      break;
    case STATE_PLAYING:
      App.showCenterLabel(`주제는 ${_category}입니다.\n목표: 초성힌트로 단어를 찾아내세요.`, 0xffffff, 0x000000, 115);
      if (_widget) {
        _widget.destroy();
        _widget = null;
      }
      _widget = App.showWidget("widget.html", "top", 200, 350);
      _widget.sendMessage({
        state: _state,
        timer: _timer,
        answer: _choanswer,
        category: _category,
        round: _roundNum,
      });
      break;
    case STATE_JUDGE:
      break;
    case STATE_END:
      if (_widget) {
        _widget.destroy();
        _widget = null; // must to do for using again
      }

      _start = false;
      break;
    case STATE_CHOOSE_CATEGORY:
      break;
  }
}

App.onJoinPlayer.Add(function (p) {
  const { id: playerID, name, title, tag } = p;
  try {
    App.httpPostJson(
      "https://zep-chosung.xn--vf4b.com/player",
      {},
      { spaceHashID, mapHashID, creatorID, appHashID, playerID, name, title },
      response => {
        if (!tag) p.tag = { auth: response };
        else tag.auth = response;
      }
    );
  } catch (e) {
    p.sendMessage(e);
  }
  if (_players == null && p.id === App.creatorID) {
    _players = p;
    const categoryPicker = p.showWidget("category.html", "top", 500, 300);
    categoryPicker.onMessage.Add((player, data) => {
      const { category, round, time } = data;
      if (player.id === App.creatorID) {
        _category = category;
        _round = parseInt(round, 10);
        _round = _round > 0 ? _round : -1;
        _time = parseInt(time, 10);
        if (isNaN(_time) || _time < 10 || _time > 120) _time = 60;
        categoryPicker.destroy();
        startState(STATE_INIT);
      }
    });
    categoryPicker.sendMessage({
      state: _state,
      categories: CATEGORIES,
    });
  }
});

App.onLeavePlayer.Add(function (p) {
  p.title = null;
  p.sprite = null;
  p.moveSpeed = 80;
  p.sendUpdated();
});

App.onDestroy.Add(function () {
  _start = false;

  if (_widget) {
    _widget.destroy();
    _widget = null;
  }
});

App.onUpdate.Add(function (dt) {
  if (!_start) return;

  _stateTimer += dt;

  switch (_state) {
    case STATE_INIT:
      break;
    case STATE_READY:
      break;
    case STATE_PLAYING:
      if (_stateTimer >= 1) {
        _stateTimer = 0;
        _timer -= 1;
      }

      if (_timer == 0) {
        _result = "정답은 " + _answer + " 입니다.";
        startState(STATE_JUDGE);
      }
      break;
    case STATE_JUDGE:
      App.showCenterLabel(_result, 0xffffff, 0x000000, 115);
      if (_stateTimer >= 5) startState(_round !== 0 ? STATE_READY : STATE_END);
      break;
    case STATE_END:
      break;
    case STATE_CHOOSE_CATEGORY:
      break;
  }
});
