import test from 'node:test'
import assert from 'node:assert/strict'
import { extractDistinctivePhrase, buildTranscriptSearchQuery } from '../lib/copyright/transcriptQuery'

test('bỏ qua transcript quá ngắn', () => {
  assert.equal(extractDistinctivePhrase('xin chao cac ban'), null)
  assert.equal(extractDistinctivePhrase(''), null)
})

test('từ chối transcript toàn từ chung chung — không đáng 100 unit', () => {
  // Toàn stopword + từ ngắn: mọi cửa sổ đều 0 điểm nên phải trả null thay vì
  // đốt quota cho một truy vấn chắc chắn trả về rác.
  const filler = 'va roi thi la co the cho nen no do nay kia '.repeat(10)
  assert.equal(extractDistinctivePhrase(filler), null)
})

test('chọn được cụm đặc trưng và bỏ phần intro', () => {
  const intro = 'xin chao cac ban da quay tro lai voi kenh cua minh hom nay '
  const body = 'phuong phap ket tinh bang dung moi huu co trong phong thi nghiem hoa hoc '
  const phrase = extractDistinctivePhrase(intro + body.repeat(3))

  assert.notEqual(phrase, null)
  // Cụm phải đến từ phần thân, không phải lời chào mở đầu.
  assert.equal(phrase!.phrase.includes('xin chao'), false)
  assert.equal(phrase!.score >= 4, true)
})

test('không lặp lại từ đã có trong tiêu đề', () => {
  // "blockchain" nằm trong tiêu đề nên truy vấn 1 đã phủ; cụm được chọn nên
  // ưu tiên phần transcript KHÁC tiêu đề.
  const title = 'Blockchain la gi'
  const transcript =
    'blockchain blockchain blockchain blockchain blockchain blockchain blockchain blockchain ' +
    'blockchain blockchain blockchain blockchain blockchain blockchain blockchain blockchain ' +
    'thuat toan dong thuan proof of stake giam thieu nang luong tieu thu dang ke'

  const phrase = extractDistinctivePhrase(transcript, title)
  assert.notEqual(phrase, null)
  // Cửa sổ toàn "blockchain" phải bị chấm 0 điểm vì trùng tiêu đề.
  assert.equal(phrase!.phrase.split(' ').every(w => w === 'blockchain'), false)
})

test('bọc ngoặc kép để YouTube khớp đúng cụm', () => {
  assert.equal(buildTranscriptSearchQuery('thuat toan dong thuan'), '"thuat toan dong thuan"')
})

test('cụm luôn đúng độ dài đã định', () => {
  const transcript = 'phuong phap ket tinh bang dung moi huu co trong phong thi nghiem hoa hoc quang pho'
  const phrase = extractDistinctivePhrase(transcript.repeat(3))
  assert.notEqual(phrase, null)
  assert.equal(phrase!.phrase.split(' ').length, 8)
})
